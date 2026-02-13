import { Injectable, Scope, type Type } from '@nestjs/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import type { ValueOf } from 'type-fest';
import type { Many } from '~/common';
import { type DataLoaderStrategy } from '~/core/data-loader';
import { type ResourceMap } from '~/core/resources';
import { ObjectViewAwareLoader } from './object-view-aware-loader.strategy';

type SomeResource = ValueOf<ResourceMap>;

type DataLoaderCtor = Type<DataLoaderStrategy<any, any>>;

export interface LoaderOptions {
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

export const LoaderFactoryMetadata = createMetadataDecorator({
  types: ['class'],
  setter: (resource?: () => Many<SomeResource>, options?: LoaderOptions) => ({
    resource,
    ...options,
  }),
});

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

    LoaderFactoryMetadata(resource, {
      ...options,
      objectViewAware:
        options?.objectViewAware ??
        Object.getPrototypeOf(target) === ObjectViewAwareLoader,
    })(target);
  };
