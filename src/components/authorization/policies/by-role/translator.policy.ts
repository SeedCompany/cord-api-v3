import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Translator, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Engagement.read,
  r.Language.read,
  r.Product.read,
  r.Project.read.children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.PeriodicReport.read,
  r.StepProgress.read,
])
export class TranslatorPolicy {}
