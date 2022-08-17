import { Global, Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { ResourceResolver } from './resource-resolver.service';

@Global()
@Module({
  imports: [GraphqlModule],
  providers: [ResourceResolver],
  exports: [ResourceResolver],
})
export class ResourceModule {}
