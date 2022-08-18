import { Global, Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { ResourceLoaderRegistry } from './loader.registry';
import { ResourceResolver } from './resource-resolver.service';
import { ResourceLoader } from './resource.loader';

@Global()
@Module({
  imports: [GraphqlModule],
  providers: [ResourceResolver, ResourceLoaderRegistry, ResourceLoader],
  exports: [ResourceResolver, ResourceLoader],
})
export class ResourceModule {}
