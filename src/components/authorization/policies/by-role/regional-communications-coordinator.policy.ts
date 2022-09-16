import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.RegionalCommunicationsCoordinator, (r) => [
  r.Education.create,
  r.Unavailability.create,
  r.User.create,

  r.Ceremony.read,
  r.FileNode.edit,
  r.Producible.read,

  r.Language.read,
  r.Engagement.read,
  r.Location.read,
  r.Partnership.read,
  r.Post.edit,
  r.Product.read,
  r.Project.read.children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.PeriodicReport.read,
  r.ProjectChangeRequest.read,
  r.StepProgress.read,
])
export class RegionalCommunicationsCoordinatorPolicy {}
