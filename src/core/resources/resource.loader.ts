import { Injectable, Type } from '@nestjs/common';
import {
  DataLoaderContext,
  DataLoaderStrategy,
} from '@seedcompany/data-loader';
import { ConditionalKeys, Merge, ValueOf } from 'type-fest';
import { ID, Many, ObjectView, ServerException } from '~/common';
import { BaseNode } from '../database/results';
import { GqlContextHost } from '../graphql';
import { ResourceLoaderRegistry } from './loader.registry';
import { ResourceMap } from './map';
import { ResourceResolver } from './resource-resolver.service';

type SomeResourceType = ValueOf<ResourceMap>;

/**
 * A reference to a resource with a dynamic / unknown type.
 */
export interface PolymorphicLinkTo<Key extends keyof ResourceMap> {
  __typename: Key;
  id: ID<Key>;
}

/**
 * A reference to a resource with a dynamic / unknown type.
 */
export type LinkToUnknown = PolymorphicLinkTo<keyof ResourceMap>;

/**
 * A reference to a resource with a static / known type.
 */
export interface LinkTo<Key extends keyof ResourceMap> {
  id: ID<Key>;
  // Here for DX, and maybe type checking.
  // Won't be used at runtime.
  __typename?: Key;
}

@Injectable()
export class ResourceLoader {
  constructor(
    private readonly loaderRegistry: ResourceLoaderRegistry,
    private readonly contextHost: GqlContextHost,
    private readonly loaderContext: DataLoaderContext,
    private readonly resourceResolver: ResourceResolver,
  ) {}

  async loadByBaseNode(node: BaseNode, view?: ObjectView) {
    // @ts-expect-error we are expecting at least one of the labels to be one
    // of our registered resources. If this turns out to be false a runtime
    // error is thrown.
    // I like this better than allowing string on load argument.
    const types: Array<keyof ResourceMap> = node.labels;
    return await this.load(types, node.properties.id, view);
  }

  async loadByRef<Key extends keyof ResourceMap>(
    obj: PolymorphicLinkTo<Key>,
    view?: ObjectView,
  ) {
    return await this.load(obj.__typename, obj.id, view);
  }

  async load<
    TResource extends SomeResourceType,
    TResourceName = ConditionalKeys<ResourceMap, TResource>,
  >(
    type: TResource,
    id: ID,
    view?: ObjectView,
  ): Promise<Merge<{ __typename: TResourceName }, TResource['prototype']>>;
  async load<TResourceName extends keyof ResourceMap>(
    type: TResourceName,
    id: ID,
    view?: ObjectView,
  ): Promise<
    Merge<
      { __typename: TResourceName },
      ResourceMap[TResourceName]['prototype']
    >
  >;
  async load(
    type: Many<keyof ResourceMap | SomeResourceType>,
    id: ID,
    view?: ObjectView,
  ): Promise<SomeResourceType['prototype'] & { __typename: string }>;
  async load(
    type: Many<keyof ResourceMap | SomeResourceType>,
    id: ID,
    view?: ObjectView,
  ): Promise<SomeResourceType['prototype'] & { __typename: string }> {
    const { factory, objectViewAware, resolvedType } =
      this.findLoaderFactory(type);
    const loader = await this.getLoader<any, any>(factory);
    const key = objectViewAware ? { id, view: view ?? { active: true } } : id;
    const result = await loader.load(key);
    return {
      // Add typename so that Resource.resolveType can work.
      // Note that this will fail when the resolvedType is an interface
      // So in those cases we expect the result to override this.
      __typename: resolvedType,
      ...result,
    };
  }

  async getLoader<T, Key, CachedKey = Key>(
    type: Type<DataLoaderStrategy<T, Key, CachedKey>>,
  ) {
    return await this.loaderContext.getLoader<T, Key, CachedKey>(
      type,
      this.contextHost.context,
    );
  }

  private findLoaderFactory(type: Many<keyof ResourceMap | SomeResourceType>) {
    // Allow GQL interfaces to be used if referenced directly & have an available
    // loader.
    if (!Array.isArray(type)) {
      const directType = ((type as SomeResourceType).name ??
        type) as keyof ResourceMap;
      const direct = this.loaderRegistry.loaders.get(directType);
      if (direct) {
        return { resolvedType: directType, ...direct };
      }
    }

    const resolvedType = this.resourceResolver.resolveType(type);
    const found = this.loaderRegistry.loaders.get(resolvedType);
    if (!found) {
      throw new ServerException(
        `Could not find loader for type: ${resolvedType}`,
      );
    }
    return { resolvedType, ...found };
  }
}
