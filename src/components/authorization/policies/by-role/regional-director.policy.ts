import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.RegionalDirector, (r) => [
  r.Education.create,
  r.Producible.create,
  r.Engagement.create,
  r.Partnership.create,
  r.Product.create,
  r.Project.create,
  r.ProjectMember.create,
  r.Unavailability.create,
  r.User.create,
  Role.assignable(r, [
    Role.Intern,
    Role.Liaison,
    Role.Mentor,
    Role.RegionalCommunicationsCoordinator,
    Role.Translator,
  ]),

  r.Budget.read.when(member).edit,
  r.BudgetRecord.read.when(member).edit,
  r.Ceremony.read.when(member).edit,
  r.FileNode.edit,
  r.Education.read,
  r.Producible.edit,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Language.read,
  r.Engagement.read
    .when(member)
    .edit.or.specifically((p) => p.disbursementCompleteDate.read),
  r.Organization.read,
  r.Partner.read.children((c) => c.posts.edit),
  r.Partnership.read.when(member).edit,
  r.Post.edit,
  r.Product.read.when(member).edit,
  r.Project.read
    .specifically((p) => p.rootDirectory.when(sensMediumOrLower).read)
    .children((c) => c.posts.edit),
  r.Project.when(member).edit,
  r.ProjectMember.read.when(member).edit,
  r.PeriodicReport.edit,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read.when(member).edit,
])
export class RegionalDirectorPolicy {}
