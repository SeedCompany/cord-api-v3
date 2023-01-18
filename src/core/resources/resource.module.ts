import { Global, Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { ResourceLoaderRegistry } from './loader.registry';
import { ResourceResolver } from './resource-resolver.service';
import { ResourceLoader } from './resource.loader';
import { ResourcesHost } from './resources.host';

@Global()
@Module({
  imports: [GraphqlModule],
  providers: [
    ResourcesHost,
    ResourceResolver,
    ResourceLoaderRegistry,
    ResourceLoader,
  ],
  exports: [
    ResourcesHost,
    ResourceResolver,
    ResourceLoaderRegistry,
    ResourceLoader,
  ],
})
export class ResourceModule {}
