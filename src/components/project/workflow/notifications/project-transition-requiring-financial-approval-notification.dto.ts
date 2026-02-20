import { Field, ObjectType } from '@nestjs/graphql';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Notification } from '../../../notifications/dto/notification.dto';
import { ProjectStep } from '../../dto';

@RegisterResource({
  db: e.Notification.ProjectTransitionRequiringFinancialApproval,
})
@ObjectType({
  implements: [Notification],
})
export class ProjectTransitionRequiringFinancialApprovalNotification extends Notification {
  readonly project: LinkTo<'Project'>;

  readonly changedBy: LinkTo<'User'>;

  @Field(() => ProjectStep)
  readonly previousStep: ProjectStep;
}

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



