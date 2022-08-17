import { Inject, Injectable, Scope } from '@nestjs/common';
import { CONTEXT } from '@nestjs/graphql';
import { ValueOf } from 'type-fest';
import {
  GqlContextType,
  ID,
  Many,
  ObjectView,
  ServerException,
} from '../../common';
import { ResourceMap } from '../../components/authorization/model/resource-map';
import { DataLoader, LoaderContextType } from '../data-loader';
import { NEST_LOADER_CONTEXT_KEY } from '../data-loader/constants';
import { BaseNode } from '../database/results';
import { ResourceLoaderRegistry } from './loader.registry';
import { ResourceResolver } from './resource-resolver.service';

type SomeResourceType = ValueOf<ResourceMap>;

interface ObjectRef<Key extends keyof ResourceMap> {
  __typename: Key;
  id: ID;
}

@Injectable({ scope: Scope.REQUEST })
export class ResourceLoader {
  constructor(
    private readonly loaderRegistry: ResourceLoaderRegistry,
    @Inject(CONTEXT)
    private readonly context: GqlContextType & {
      [NEST_LOADER_CONTEXT_KEY]: LoaderContextType;
    },
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

  async load<TResource extends SomeResourceType>(
    type: TResource,
    id: ID,
    view?: ObjectView
  ): Promise<TResource['prototype']>;
  async load<TResourceName extends keyof ResourceMap>(
    type: TResourceName,
    id: ID,
    view?: ObjectView
  ): Promise<ResourceMap[TResourceName]['prototype']>;
  async load(
    type: Many<keyof ResourceMap | SomeResourceType>,
    id: ID,
    view?: ObjectView
  ): Promise<SomeResourceType['prototype']>;
  async load(
    type: Many<keyof ResourceMap | SomeResourceType>,
    id: ID,
    view?: ObjectView
  ): Promise<SomeResourceType['prototype']> {
    const { factory, objectViewAware, resolvedType } =
      this.findLoaderFactory(type);
    const loader: DataLoader<any, any> = await this.context[
      NEST_LOADER_CONTEXT_KEY
    ].getLoader(factory);
    const key = objectViewAware ? { id, view: view ?? { active: true } } : id;
    const result = await loader.load(key);
    return {
      __typename: resolvedType, // Add typename so that Resource.resolveType can work.
      ...result,
    };
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
