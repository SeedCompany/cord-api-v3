import { member, Policy, Role, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Consultant, (r) => [
  r.FieldRegion.read,
  r.FieldZone.read,
  r.Language.read,
  r.EthnologueLanguage.read,
  r.Partner.when(member).read.or.specifically((p) => p.pmcEntityCode.edit),

  r.Partner.when(member).read,
  r.Partner.specifically((p) => p.pmcEntityCode.edit),

  r.Project.when(member).read,
  r.ProjectChangeRequest.edit,
  r.Budget.when(member).read,
  r.BudgetRecord.when(member).read,
  r.Partnership.whenAll(member, sensOnlyLow).read,
  r.Engagement.edit,
  r.Ceremony.read,
  r.Product.read,
  r.ProjectMember.read,
  r.StepProgress.read,
  r.PeriodicReport.read,

  r.User.read.create,
  r.Unavailability.read,
  r.FileNode.edit.create,
  r.Post.edit,
])
export class ConsultantPolicy {}
