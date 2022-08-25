import { Injectable, PipeTransform } from '@nestjs/common';
import { isPlainObject } from 'lodash';
import { ID, InputException, isIdLike } from '../../common';
import {
  GqlContextHost,
  LoaderContextType,
  NotGraphQLContext,
} from '../../core';
import { NEST_LOADER_CONTEXT_KEY as Loaders } from '../../core/data-loader/constants';
import { ResourceLoaderRegistry } from '../../core/resources/loader.registry';
import { Changeset } from './dto';
import { shouldValidateEditability } from './validate-editability.decorator';

/**
 * Ensure changeset ID referenced is editable if called in a mutation.
 *
 * This is implemented as a Pipe because it has the input objects transformed
 * to their class instances (via ValidationPipe), which allows us to reference
 * metadata defined on class definition.
 * This logic is more suited for a Guard or Interceptor, but we don't have that
 * information easily accessible at that point.
 * Though it could be possible with some work.
 */
@Injectable()
export class EnforceChangesetEditablePipe implements PipeTransform {
  constructor(
    private readonly contextHost: GqlContextHost,
    // Cannot use request scoped injection here in global pipes,
    // So we have to re-create the loader fetching here.
    private readonly loaderRegistry: ResourceLoaderRegistry
  ) {}

  async transform(value: any) {
    await this.validateRequest(value);
    return value;
  }

  async validateRequest(value: any) {
    let context;

    try {
      ({ context } = this.contextHost);
    } catch (e) {
      if (e instanceof NotGraphQLContext) {
        // Nothing to do if not GQL request
        return;
      }
      throw e;
    }

    if (context.operation.operation !== 'mutation') {
      return;
    }

    const ids = this.findIdsToValidate(value);
    if (ids.length === 0) {
      return;
    }

    const loaderFactory = this.loaderRegistry.loaders.get('Changeset')!.factory;
    const { [Loaders]: loaders } = context as any as {
      [Loaders]: LoaderContextType;
    };
    const loader = await loaders.getLoader<Changeset>(loaderFactory);

    const changesets = await loader.loadMany(ids);
    for (const changeset of changesets) {
      if (changeset instanceof Error) {
        throw changeset;
      }
      if (!changeset.editable) {
        throw new InputException('Changeset is not editable');
      }
    }
  }

  findIdsToValidate(value: any) {
    if (!isInstance(value)) {
      return [];
    }

    let ids: ID[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (isIdLike(val) && shouldValidateEditability(value, key)) {
        ids.push(val);
      }
      ids = [...ids, ...this.findIdsToValidate(val)];
    }

    return ids;
  }
}

const isInstance = (value: any) =>
  value && typeof value === 'object' && !isPlainObject(value);
