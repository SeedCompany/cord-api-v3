import { field, Policy, Role } from '../util';

@Policy(Role.FieldServices, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  // budget-line-items-poc: equivalent grant to Budget/BudgetRecord above,
  // extended to create/delete since these two resources (unlike
  // Budget/BudgetRecord, see commit 430eeda0f) get real CRUD mutations.
  r.BudgetLineItem.edit.create.delete,
  r.OtherPartnerContribution.edit.create.delete,
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
  r.Project.edit.create.delete.specifically((p) => [
    p.many('mouStart', 'mouEnd').when(field('status', 'InDevelopment')).edit,
  ]),
  r.ProjectMember.edit.create.delete,
  r.PeriodicReport.edit,
  r.ToolUsage.edit.create.delete,
  r.StepProgress.edit,
])
export class FieldServicesPolicy {}
