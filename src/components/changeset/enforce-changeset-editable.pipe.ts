import { Injectable, PipeTransform } from '@nestjs/common';
import { isPlainObject } from 'lodash';
import { ID, InputException, isIdLike } from '../../common';
import { GqlContextHost, LoaderContextType } from '../../core';
import { NEST_LOADER_CONTEXT_KEY as Loaders } from '../../core/data-loader/constants';
import { ResourceLoaderRegistry } from '../../core/resources/loader.registry';
import { Changeset } from './dto';
import { shouldValidateEditability } from './validate-editability.decorator';

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
    const { context } = this.contextHost;
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
