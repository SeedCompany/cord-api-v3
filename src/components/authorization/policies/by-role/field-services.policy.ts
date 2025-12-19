import { Policy, Role } from '../util';

@Policy(Role.FieldServices, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.Education.edit,
  r.Engagement.edit.create.delete,
  r.Language.edit.create.delete,
  r.Partner.edit.create.delete,
  r.Partnership.create.delete.specifically((p) => [
    p.many('agreement', 'agreementStatus', 'types', 'partner', 'primary').edit,
  ]),
  r.Producible.edit.create,
  r.Product.edit.create.delete,
  r.Project.edit.create.delete,
  r.ProjectMember.edit.create.delete,
  r.PeriodicReport.edit,
  r.ToolUsage.edit.create.delete,
  r.StepProgress.edit,
])
export class FieldServicesPolicy {}
