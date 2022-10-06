import { member, Policy, Role, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.Consultant, Role.ConsultantManager], (r) => [
  r.Ceremony.read,
  r.Budget.when(member).read,
  r.BudgetRecord.when(member).read,
  r.Engagement.edit,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.Language.read,
  r.Partner.when(member).read.or.specifically((p) => p.pmcEntityCode.edit),
  r.Partner.when(member).read,
  r.Partner.specifically((p) => p.pmcEntityCode.edit),
  r.Partnership.whenAll(member, sensOnlyLow).read,
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.when(member).read,
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read.create,
])
export class ConsultantPolicy {}
