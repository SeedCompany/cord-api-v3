import { Global, Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { ResourceLoaderRegistry } from './loader.registry';
import { ResourceResolver } from './resource-resolver.service';

@Global()
@Module({
  imports: [GraphqlModule],
  providers: [ResourceResolver, ResourceLoaderRegistry],
  exports: [ResourceResolver],
})
export class ResourceModule {}
