import { Injectable, Scope, SetMetadata } from '@nestjs/common';
import { ValueOf } from 'type-fest';
import { Many } from '../../common';
import { ResourceMap } from '../../components/authorization/model/resource-map';
import { NestDataLoader, ObjectViewAwareLoader } from '../data-loader';

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
   * {@link import('../data-loader/object-view-aware.loader').Key Key}
   *
   * This defaults to true if the class extends ObjectViewAwareLoader.
   */
  objectViewAware?: boolean;
}

type DataLoaderCtor = new (...args: any[]) => NestDataLoader<any, any>;

/**
 * Register this class as a DataLoader for the given resource(s)
 *
 * @param resource Connect this loader to this resource, so it can be accessed dynamically.
 * @param options
 */
export const LoaderFactory =
  (
    resource?: () => Many<SomeResource>,
    options?: LoaderOptions
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
