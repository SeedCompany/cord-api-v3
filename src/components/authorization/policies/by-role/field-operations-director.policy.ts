import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.FieldOperationsDirector, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.edit,
  r.Education.read,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FileNode.edit,
  r.FundingAccount.read,
  r.Engagement.edit.specifically((p) => p.disbursementCompleteDate.read),
  r.Language.read,
  r.Organization.read,
  r.Partner.read.children((p) => p.posts.edit),
  r.Partnership.read.specifically((p) => [
    p.many(
      'agreement',
      'agreementStatus',
      'types',
      'organization',
      'partner',
      'primary'
    ).edit,
  ]),
  r.Post.edit,
  r.Producible.edit.create,
  r.Product.edit,
  r.Project.edit.create,
  r.ProjectMember.edit.create,
  r.PeriodicReport.edit,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit.create,
  r.StepProgress.edit,

  Role.assignable(r, [
    Role.Intern,
    Role.Liaison,
    Role.Mentor,
    Role.RegionalCommunicationsCoordinator,
    Role.Translator,
  ]),
])
export class FieldOperationsDirectorPolicy {}
