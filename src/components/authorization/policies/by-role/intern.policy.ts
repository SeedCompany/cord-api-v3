import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Intern, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.Education.edit,
  r.Producible.edit,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FileNode.edit,
  r.FundingAccount.read,
  r.Engagement.edit,
  r.Language.read,
  r.Organization.read,
  r.Partner.edit,
  r.Partnership.edit,
  r.Post.edit,
  r.Product.edit,
  r.Project.edit,
  r.ProjectMember.edit,
  r.PeriodicReport.read,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class InternPolicy {}
