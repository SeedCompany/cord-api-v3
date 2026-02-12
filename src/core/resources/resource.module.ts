import { Global, Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { DefaultTypeNameService } from './default-typename.service';
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
    DefaultTypeNameService,
  ],
  exports: [
    ResourcesHost,
    ResourceResolver,
    ResourceLoaderRegistry,
    ResourceLoader,
  ],
})
export class ResourceModule {}
