import { member, Policy, Role } from '../util';

// Who may move a GTL quarterly report through its workflow, and who may read
// the event history it leaves behind. One class per `@Policy`, since each
// decorator takes one role list.
//
// Field Partner and Project Manager act on their OWN projects, so their grants
// are member-conditioned — the read too, which closes the POC hole where any
// Field Partner anywhere could sign off. Regional Director, Field Operations
// Director and Marketing oversee many projects and are not added as members,
// so their grants are global, matching Momentum's Progress Report.

const fieldSide = [
  'Start',
  'Send to Supervisor',
  'Sign Off & Submit',
  'Withdraw',
] as const;

const reviewSide = [
  'Send for Translation',
  'Ready for Review',
  'Request Changes',
  'Approve',
] as const;

@Policy([Role.FieldPartner, Role.ProjectManager], (r) => [
  r.GtlReportWorkflowEvent.when(member).read.whenAll(
    member,
    r.GtlReportWorkflowEvent.isTransitions(...fieldSide),
  ).execute,
])
export class GtlReportFieldSideWorkflowPolicy {}

@Policy(Role.ProjectManager, (r) => [
  r.GtlReportWorkflowEvent.when(member).read.whenAll(
    member,
    r.GtlReportWorkflowEvent.isTransitions(...reviewSide),
  ).execute,
])
export class GtlReportProjectManagerReviewPolicy {}

@Policy([Role.RegionalDirector, Role.FieldOperationsDirector], (r) => [
  // Mirrors Marketing's "allows access to workflow" grant on the status prop.
  // The UI reads the available transitions off `status`, and these roles'
  // report read is otherwise member-conditioned (they share the Project
  // Manager policy), so without this a director who is not on the project
  // could execute a transition by key but never see one to click.
  r.GTLReport.specifically((p) => p.status.read),
  r.GtlReportWorkflowEvent.read.transitions(...reviewSide).execute,
])
export class GtlReportDirectorReviewPolicy {}

@Policy([Role.Marketing, Role.FieldOperationsDirector], (r) => [
  r.GtlReportWorkflowEvent.read.transitions('Publish').execute,
])
export class GtlReportPublishPolicy {}

@Policy(Role.Translator, (r) => [r.GtlReportWorkflowEvent.when(member).read])
export class GtlReportTranslatorReadsWorkflowPolicy {}
