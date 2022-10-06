import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Liaison, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Engagement.read,
  r.Language.read,
  r.Partnership.read,
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read,
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read.create,
  r.User.read.create,
])
export class LiaisonPolicy {}
