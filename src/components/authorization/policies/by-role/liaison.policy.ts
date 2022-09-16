import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Liaison, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.FileNode.edit.create,
  r.Producible.read,
  r.Engagement.read,
  r.Language.read,
  r.Location.read,
  r.Partnership.read,
  r.Post.edit,
  r.Product.read,
  r.Project.read,
  r.ProjectMember.read,
  r.PeriodicReport.read,
  r.User.read.create,
  r.Unavailability.read.create,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class LiaisonPolicy {}
