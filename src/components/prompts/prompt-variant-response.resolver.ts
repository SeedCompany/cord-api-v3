import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue, Resource } from '~/common';
import { Loader, type LoaderOf, ResourceLoader } from '~/core';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import { PromptResponse, PromptVariantResponse, VariantResponse } from './dto';

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

  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() response: PromptVariantResponse,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ) {
    return await mapSecuredValue(response.creator, ({ id }) => users.load(id));
  }
}

@Resolver(() => VariantResponse)
export class VariantResponseResolver {
  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() response: VariantResponse,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ) {
    return await mapSecuredValue(response.creator, ({ id }) => users.load(id));
  }
}
