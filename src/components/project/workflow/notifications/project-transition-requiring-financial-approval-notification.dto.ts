import { ObjectType } from '@nestjs/graphql';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Notification } from '../../../notifications';
import { ProjectTransitionNotification } from './project-transition-notification.dto';

@RegisterResource({
  db: e.Notification.ProjectTransitionRequiringFinancialApproval,
})
@ObjectType({ implements: [ProjectTransitionNotification, Notification] })
export class ProjectTransitionRequiringFinancialApprovalNotification extends ProjectTransitionNotification {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProjectTransitionRequiringFinancialApprovalNotification: typeof ProjectTransitionRequiringFinancialApprovalNotification;
  }
  interface ResourceDBMap {
    ProjectTransitionRequiringFinancialApprovalNotification: typeof e.Notification.ProjectTransitionRequiringFinancialApproval;
  }
}

declare module '../../../notifications' {
  interface NotificationMap {
    ProjectTransitionRequiringFinancialApproval: typeof ProjectTransitionRequiringFinancialApprovalNotification;
  }
}
