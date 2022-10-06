import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.RegionalCommunicationsCoordinator, (r) => [
  r.Ceremony.read,
  r.Education.create,
  r.Engagement.read,
  r.Language.read,
  r.Partnership.read,
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read.children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.create,
  r.User.create,
])
export class RegionalCommunicationsCoordinatorPolicy {}
