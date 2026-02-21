import { NotificationStrategy } from '../../../notifications';
import { ProjectTransitionNotificationStrategy } from './project-transition-notification.strategy';
import { ProjectTransitionRequiringFinancialApprovalNotification } from './project-transition-requiring-financial-approval-notification.dto';

@NotificationStrategy(ProjectTransitionRequiringFinancialApprovalNotification)
export class ProjectTransitionRequiringFinancialApprovalNotificationStrategy extends ProjectTransitionNotificationStrategy<ProjectTransitionRequiringFinancialApprovalNotification> {
  protected readonly dtoClass =
    ProjectTransitionRequiringFinancialApprovalNotification;

  getDescription() {
    return 'When a project transitions to a step requiring financial approval';
  }
}
