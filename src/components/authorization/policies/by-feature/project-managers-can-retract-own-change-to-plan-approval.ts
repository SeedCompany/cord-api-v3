import { member, Policy, Role } from '../util';

@Policy(Role.ProjectManager, (r) => [
  r.ProjectWorkflowEvent.whenAll(
    member,
    r.ProjectWorkflowEvent.isTransitions(
      'Retract Change To Plan Approval Request',
    ),
  ).execute,
])
export class ProjectManagersCanRetractOwnChangeToPlanApproval {}
