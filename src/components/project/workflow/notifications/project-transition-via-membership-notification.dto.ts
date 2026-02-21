import { ObjectType } from '@nestjs/graphql';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { ProjectTransitionNotification } from './project-transition-notification.dto';

@RegisterResource({ db: e.Notification.ProjectTransitionViaMembership })
@ObjectType({ implements: [ProjectTransitionNotification] })
export class ProjectTransitionViaMembershipNotification extends ProjectTransitionNotification {}

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
