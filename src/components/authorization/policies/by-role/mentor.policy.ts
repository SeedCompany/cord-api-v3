import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Mentor, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.FileNode.edit,
  r.Producible.read,
  r.FundingAccount.read,
  r.Engagement.read,
  r.Language.read,
  r.Location.read,
  r.Organization.read,
  r.Partner.read,
  r.Partnership.read,
  r.Post.edit,
  r.Product.read,
  r.Project.read.children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.PeriodicReport.read,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class MentorPolicy {}
