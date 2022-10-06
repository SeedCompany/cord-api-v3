import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Mentor, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Engagement.read,
  r.FundingAccount.read,
  r.Language.read,
  r.Organization.read,
  r.Partner.read,
  r.Partnership.read,
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read.children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read,
])
export class MentorPolicy {}
