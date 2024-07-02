import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.FieldOperationsDirector, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.Education.edit,
  r.Engagement.edit.specifically((p) => p.disbursementCompleteDate.read),
  r.Partner.read,
  r.Partnership.create.delete.specifically((p) => [
    p.many('agreement', 'agreementStatus', 'types', 'partner', 'primary').edit,
  ]),
  r.Producible.edit.create,
  r.Product.edit.create.delete,
  r.Project.edit,
  r.ProjectMember.edit.create.delete,
  r.ProjectWorkflowEvent.read.transitions(
    'Field Ops Approves Proposal',
    'Field Ops Requests Proposal Changes',
    'Field Ops Rejects Proposal',
  ).execute,
  r.PeriodicReport.edit,
  r.StepProgress.edit,
])
export class FieldOperationsDirectorPolicy {}
