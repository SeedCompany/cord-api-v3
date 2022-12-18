import { Policy, Role } from '../util';

@Policy(
  [Role.ProjectManager, Role.RegionalDirector, Role.FieldOperationsDirector],
  (r) => [r.ProgressReportWorkflowEvent.read]
)
export class ViewAllProgressWorkflowEventsPolicy {}
