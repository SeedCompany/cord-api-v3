import { Injectable, type OnModuleInit, Scope, type Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { type DataLoaderStrategy } from '@seedcompany/data-loader';
import { many } from '~/common';
import { type ResourceMap } from '~/core';
import { LoaderFactoryMetadata, type LoaderOptions } from '../data-loader/loader-factory.decorator';

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
        if (!provider.metatype) {
          return [];
        }
        const metadata = LoaderFactoryMetadata.get(provider.metatype as Type);
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
