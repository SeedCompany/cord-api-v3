import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { User } from '../../../user/dto';
import { UserLoader } from '../../../user/user.loader';
import { IProject } from '../../dto';
import { ProjectLoader } from '../../project.loader';
import { ProjectTransitionViaMembershipNotification as Notification } from './project-transition-via-membership-notification.dto';

@Resolver(Notification)
export class ProjectTransitionViaMembershipNotificationResolver {
  @ResolveField(() => IProject)
  async project(
    @Parent() { project }: Notification,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ) {
    return await projects.load({
      id: project.id,
      view: { active: true },
    });
  }

  @ResolveField(() => User)
  async changedBy(
    @Parent() { changedBy }: Notification,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ) {
    return await users.load(changedBy.id);
  }
}
