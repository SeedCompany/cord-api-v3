import { field, Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.FieldOperationsDirector, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  // budget-line-items-poc: equivalent grant to Budget/BudgetRecord above,
  // extended to create/delete since these two resources get real CRUD
  // mutations — see the final report's "reintroduces line-item-level CRUD"
  // note.
  r.BudgetLineItem.edit.create.delete,
  r.OtherPartnerContribution.edit.create.delete,
  r.Ceremony.edit,
  r.Education.edit,
  r.Engagement.edit.specifically((p) => p.disbursementCompleteDate.read),
  r.Partner.read,
  r.Partnership.create.delete.specifically((p) => [
    p.many('agreement', 'agreementStatus', 'types', 'partner', 'primary').edit,
  ]),
  r.Producible.edit.create,
  r.Product.edit.create.delete,
  r.Project.edit.specifically((p) => [
    p.departmentId.read,
    p.many('mouStart', 'mouEnd').when(field('status', 'InDevelopment')).edit,
  ]),
  r.ProjectMember.edit.create.delete,
  r.ProjectWorkflowEvent.read.transitions(
    'Field Ops Approves Proposal',
    'Field Ops Requests Proposal Changes',
    'Field Ops Rejects Proposal',
  ).execute,
  r.PeriodicReport.edit,
  r.ToolUsage.edit.create.delete,
  r.StepProgress.edit,
])
export class FieldOperationsDirectorPolicy {}
