import { inherit, member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(
  [Role.ProjectManager, Role.RegionalDirector, Role.FieldOperationsDirector],
  (r) => [
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
    r.Education.read.create,
    ...inherit(
      r.Engagement.read.create
        .when(member)
        .edit.specifically((p) => p.disbursementCompleteDate.read),
      r.LanguageEngagement.specifically((p) => [
        p.paratextRegistryId.when(member).read,
      ])
    ),
    r.EthnologueLanguage.read,
    r.FieldRegion.read,
    r.FieldZone.read,
    r.FundingAccount.read,
    r.Language.read,
    r.Organization.read,
    r.Partner.read
      .specifically((p) => p.pmcEntityCode.none)
      .children((c) => c.posts.read.create),
    r.Partnership.whenAny(member, sensMediumOrLower).read.create.specifically(
      (p) => [
        p.many('agreement', 'agreementStatus', 'types', 'partner', 'primary')
          .edit,
      ]
    ),
    r.PeriodicReport.read.when(member).edit,
    r.Producible.edit.create,
    r.Product.read.when(member).edit.create,
    r.Project.read.create
      .when(member)
      .edit.specifically((p) => [
        p
          .many('rootDirectory', 'otherLocations', 'primaryLocation')
          .whenAny(member, sensMediumOrLower).read,
      ])
      .children((c) => c.posts.read.create),
    r.ProjectMember.read.when(member).edit.create,
    r.StepProgress.read.when(member).edit,
    r.Unavailability.create.read,
    r.User.create.read,
  ]
)
export class ProjectManagerPolicy {}
