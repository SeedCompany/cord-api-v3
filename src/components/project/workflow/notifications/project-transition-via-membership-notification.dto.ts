import { Field, ObjectType } from '@nestjs/graphql';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Notification } from '../../../notifications/dto/notification.dto';
import { ProjectStep } from '../../dto';

@RegisterResource({ db: e.Notification.ProjectTransitionViaMembership })
@ObjectType({
  implements: [Notification],
})
export class ProjectTransitionViaMembershipNotification extends Notification {
  readonly project: LinkTo<'Project'>;

  readonly changedBy: LinkTo<'User'>;

  @Field(() => ProjectStep)
  readonly previousStep: ProjectStep;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProjectTransitionViaMembershipNotification: typeof ProjectTransitionViaMembershipNotification;
  }
  interface ResourceDBMap {
    ProjectTransitionViaMembershipNotification: typeof e.Notification.ProjectTransitionViaMembership;
  }
}

declare module '../../../notifications' {
  interface NotificationMap {
    ProjectTransitionViaMembership: typeof ProjectTransitionViaMembershipNotification;
  }
}



