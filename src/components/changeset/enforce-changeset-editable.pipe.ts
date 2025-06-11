import { type ArgumentMetadata, Injectable, type PipeTransform, type Type } from '@nestjs/common';
import { hasCtor, isRegularObject } from '@seedcompany/common';
import { DataLoaderContext, type DataLoaderStrategy } from '@seedcompany/data-loader';
import { type ID, InputException, isIdLike, loadManyIgnoreMissingThrowAny } from '~/common';
import { GqlContextHost, ifGqlContext } from '~/core/graphql';
import { ResourceLoaderRegistry } from '~/core/resources/loader.registry';
import { type Changeset } from './dto';
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
 *
 * Since this is registered as a global/app pipe,
 * it is called for every argument of every resolver/controller.
 * So we want to be careful to do as little work as possible.
 */
@Injectable()
export class EnforceChangesetEditablePipe implements PipeTransform {
  constructor(
    private readonly gqlContextHost: GqlContextHost,
    private readonly loaderRegistry: ResourceLoaderRegistry,
    private readonly loaderContext: DataLoaderContext,
  ) {}

  async transform(value: unknown, metadata: ArgumentMetadata) {
    await this.validateRequest(value, metadata);
    return value;
  }

  async validateRequest(value: unknown, metadata: ArgumentMetadata) {
    // "body" translates to GQL args
    if (metadata.type !== 'body') {
      return;
    }

    const context = ifGqlContext(this.gqlContextHost.contextMaybe);
    if (context?.operation.operation !== 'mutation') {
      return;
    }

    const ids = this.findIdsToValidate(value);
    if (ids.length === 0) {
      return;
    }

    const loaderFactory: Type<DataLoaderStrategy<Changeset, ID>> =
      this.loaderRegistry.loaders.get('Changeset')!.factory;
    const loader = await this.loaderContext.getLoader(loaderFactory, context);

    const changesets = await loadManyIgnoreMissingThrowAny(loader, ids);
    for (const changeset of changesets) {
      if (!changeset.editable) {
        throw new InputException('Changeset is not editable');
      }
    }
  }

  findIdsToValidate(value: unknown) {
    if (!isInputClassInstanceLike(value)) {
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

const isInputClassInstanceLike = (value: unknown): value is object =>
  isRegularObject(value) && hasCtor(value);
