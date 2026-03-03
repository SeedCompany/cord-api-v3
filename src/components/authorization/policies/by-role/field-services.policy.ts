import { Policy, Role } from '../util';

@Policy(Role.FieldServices, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.Education.edit,
  r.Engagement.edit.create.delete,
  r.Language.edit.create.delete.children((c) => c.posts.edit.create.delete),
  r.EthnologueLanguage.create.read.edit.delete,
  r.FieldRegion.create.read.edit.delete,
  r.FieldZone.create.read.edit.delete,
  r.Location.create.read.edit.delete,
  r.Tool.create.read.edit.delete,
  r.Partner.edit.create.delete,
  r.Partnership.create.delete.specifically((p) => [
    p.many('agreement', 'agreementStatus', 'types', 'partner', 'primary').edit,
  ]),
  r.Product.edit.create.delete,
  r.Project.edit.create.delete,
  r.ProjectMember.edit.create.delete,
  r.PeriodicReport.edit,
  r.ToolUsage.edit.create.delete,
  r.StepProgress.edit,
])
export class FieldServicesPolicy {}
