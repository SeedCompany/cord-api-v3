import {
  Injectable,
  OnModuleInit,
  Scope,
  SetMetadata,
  Type,
} from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { DataLoaderStrategy } from '@seedcompany/data-loader';
import { ValueOf } from 'type-fest';
import { many, Many } from '~/common';
import { ResourceMap } from '~/core';
import { ObjectViewAwareLoader } from '../data-loader';

type SomeResource = ValueOf<ResourceMap>;

const LOADER_OF_RESOURCE = Symbol('LOADER_OF_RESOURCE');

interface MetadataShape extends LoaderOptions {
  resource?: () => Many<SomeResource>;
}

interface LoaderOptions {
  /**
   * Whether the loader is aware of ObjectViews.
   *
   * This means the loader key needs to be in the shape of
   * {@link import('../data-loader/object-view-aware-loader.strategy').Key Key}
   *
   * This defaults to true if the class extends ObjectViewAwareLoader.
   */
  objectViewAware?: boolean;
}

type DataLoaderCtor = Type<DataLoaderStrategy<any, any>>;

/**
 * Register this class as a DataLoader for the given resource(s)
 *
 * @param resource Connect this loader to this resource, so it can be accessed dynamically.
 * @param options
 */
export const LoaderFactory =
  (
    resource?: () => Many<SomeResource>,
    options?: LoaderOptions,
  ): (<LoaderCtor extends DataLoaderCtor>(target: LoaderCtor) => void) =>
  (target) => {
    Injectable({ scope: Scope.REQUEST })(target);

    const metadata: MetadataShape = {
      resource,
      ...options,
      objectViewAware:
        options?.objectViewAware ??
        Object.getPrototypeOf(target) === ObjectViewAwareLoader,
    };
    SetMetadata(LOADER_OF_RESOURCE, metadata)(target);
  };

@Injectable()
export class ResourceLoaderRegistry implements OnModuleInit {
  readonly loaders = new Map<
    keyof ResourceMap,
    { factory: Type<DataLoaderStrategy<any, any>> } & LoaderOptions
  >();

  constructor(private readonly modulesContainer: ModulesContainer) {}

  async onModuleInit() {
    const loaderFactories = [...this.modulesContainer.values()]
      .flatMap((nestModule) => [...nestModule.providers.values()])
      .filter((provider) => provider.scope === Scope.REQUEST)
      .flatMap((provider) => {
        const metadata = Reflect.getMetadata(
          LOADER_OF_RESOURCE,
          provider.metatype,
        ) as MetadataShape | undefined;
        return metadata ? { ...metadata, provider } : [];
      });
    for (const { resource, provider, ...options } of loaderFactories) {
      const types = resource ? many(resource()) : [];
      for (const type of types) {
        // @ts-expect-error yes, yes very dynamic, destination is stricter
        this.loaders.set(type.name, { factory: provider.metatype, ...options });
      }
    }
  }
}
