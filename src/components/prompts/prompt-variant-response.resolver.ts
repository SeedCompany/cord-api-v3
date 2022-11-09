import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '~/common';
import { ResourceLoader } from '~/core';
import { PromptResponse, PromptVariantResponse } from './dto';

@Resolver(() => PromptResponse)
export class PromptResponseResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField(() => Resource)
  async parent(@Parent() response: PromptResponse) {
    return await this.resources.loadByRef(response.parent);
  }
}

@Resolver(() => PromptVariantResponse)
export class PromptVariantResponseResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField(() => Resource)
  async parent(@Parent() response: PromptVariantResponse) {
    return await this.resources.loadByBaseNode(response.parent);
  }
}
