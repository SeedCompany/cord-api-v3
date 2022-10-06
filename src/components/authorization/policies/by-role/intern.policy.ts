import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Intern, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.Education.edit,
  r.Engagement.edit,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Language.read,
  r.Organization.read,
  r.PeriodicReport.read,
  r.Partner.edit,
  r.Partnership.edit,
  r.Producible.edit,
  r.Product.edit,
  r.Project.edit,
  r.ProjectMember.edit,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read,
])
export class InternPolicy {}
