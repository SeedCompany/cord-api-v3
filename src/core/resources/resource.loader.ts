import { Injectable, Type } from '@nestjs/common';
import { ConditionalKeys, ValueOf } from 'type-fest';
import { ID, Many, ObjectView, ServerException } from '~/common';
import { GqlContextHost } from '~/core/graphql';
import { LoaderContextType, LoaderOf, NestDataLoader } from '../data-loader';
import { NEST_LOADER_CONTEXT_KEY } from '../data-loader/constants';
import { BaseNode } from '../database/results';
import { ResourceLoaderRegistry } from './loader.registry';
import { ResourceMap } from './map';
import { ResourceResolver } from './resource-resolver.service';

type SomeResourceType = ValueOf<ResourceMap>;

interface ObjectRef<Key extends keyof ResourceMap> {
  __typename: Key;
  id: ID;
}

@Injectable()
export class ResourceLoader {
  constructor(
    private readonly loaderRegistry: ResourceLoaderRegistry,
    private readonly contextHost: GqlContextHost,
    private readonly resourceResolver: ResourceResolver
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
    obj: ObjectRef<Key>,
    view?: ObjectView
  ) {
    return await this.load(obj.__typename, obj.id, view);
  }

  async load<
    TResource extends SomeResourceType,
    TResourceName = ConditionalKeys<ResourceMap, TResource>
  >(
    type: TResource,
    id: ID,
    view?: ObjectView
  ): Promise<TResource['prototype'] & { __typename: TResourceName }>;
  async load<TResourceName extends keyof ResourceMap>(
    type: TResourceName,
    id: ID,
    view?: ObjectView
  ): Promise<
    ResourceMap[TResourceName]['prototype'] & { __typename: TResourceName }
  >;
  async load(
    type: Many<keyof ResourceMap | SomeResourceType>,
    id: ID,
    view?: ObjectView
  ): Promise<SomeResourceType['prototype'] & { __typename: string }>;
  async load(
    type: Many<keyof ResourceMap | SomeResourceType>,
    id: ID,
    view?: ObjectView
  ): Promise<SomeResourceType['prototype'] & { __typename: string }> {
    const { factory, objectViewAware, resolvedType } =
      this.findLoaderFactory(type);
    const loader = await this.getLoader(factory);
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

  async getLoader<T extends NestDataLoader<any, any>>(
    factory: Type<T>
  ): Promise<LoaderOf<T>> {
    const context = this.contextHost.context as unknown as {
      [NEST_LOADER_CONTEXT_KEY]: LoaderContextType;
    };
    const loader = await context[NEST_LOADER_CONTEXT_KEY].getLoader(factory);
    return loader as LoaderOf<T>;
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
        `Could not find loader for type: ${resolvedType}`
      );
    }
    return { resolvedType, ...found };
  }
}
