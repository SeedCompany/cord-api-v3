import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { SecuredUser, UserLoader } from '../user';
import { ProjectStepChange } from './dto';

@Resolver(ProjectStepChange)
export class ProjectStepTransitionResolver {
  @ResolveField(() => SecuredUser)
  async user(
    @Parent() stepChange: ProjectStepChange,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser | null> {
    if (!stepChange.user) {
      return null;
    }
    return await mapSecuredValue(stepChange.user, (id) => users.load(id));
  }
}
