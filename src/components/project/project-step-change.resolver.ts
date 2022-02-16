import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { SecuredUser, UserLoader } from '../user';
import { ProjectStepChange } from './dto';

@Resolver(ProjectStepChange)
export class ProjectStepChangeResolver {
  @ResolveField(() => SecuredUser)
  async by(
    @Parent() stepChange: ProjectStepChange,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(stepChange.user, (id) => users.load(id));
  }
}
