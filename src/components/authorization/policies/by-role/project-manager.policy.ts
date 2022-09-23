import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.ProjectManager, (r) => [
  r.Education.create,
  r.Producible.create,
  r.Project.create,
  r.Engagement.create,
  r.Partnership.create,
  r.Unavailability.create,
  r.User.create,
  Role.assignable(r, [
    Role.Intern,
    Role.Liaison,
    Role.Mentor,
    Role.RegionalCommunicationsCoordinator,
    Role.Translator,
  ]),

  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.FileNode.edit,
  r.Education.read,
  r.Producible.edit,
  r.EthnologueLanguage.read,
  r.FundingAccount.read,
  r.Language.read,
  r.Engagement.edit.specifically((p) => p.disbursementCompleteDate.read),
  r.Organization.read,
  r.Partner.read
    .specifically((p) => p.pmcEntityCode.none)
    .children((c) => c.posts.edit),
  r.Partnership.read.specifically((p) => [
    p.many('agreement', 'agreementStatus', 'types', 'organization', 'primary')
      .edit,
    p.partner.whenAny(member, sensMediumOrLower).edit,
  ]),
  r.Post.edit,
  r.Product.edit,
  r.Project.edit.specifically((p) => [
    p
      .many('rootDirectory', 'otherLocations', 'primaryLocation')
      .whenAny(member, sensMediumOrLower).edit,
  ]),
  r.FieldRegion.edit,
  r.FieldZone.edit,
  r.ProjectMember.edit,
  r.PeriodicReport.read.when(member).edit,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit.when(member).create,
  r.StepProgress.read.when(member).edit,
])
export class ProjectManagerPolicy {}
