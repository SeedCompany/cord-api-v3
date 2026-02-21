import { NotificationStrategy } from '../../../notifications';
import { ProjectTransitionNotificationStrategy } from './project-transition-notification.strategy';
import { ProjectTransitionViaMembershipNotification } from './project-transition-via-membership-notification.dto';

@NotificationStrategy(ProjectTransitionViaMembershipNotification)
export class ProjectTransitionViaMembershipNotificationStrategy extends ProjectTransitionNotificationStrategy<ProjectTransitionViaMembershipNotification> {
  protected readonly dtoClass = ProjectTransitionViaMembershipNotification;

  getDescription() {
    return 'When a project you are a member of transitions to a new step';
  }
}
