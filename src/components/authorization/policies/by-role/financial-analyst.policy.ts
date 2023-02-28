import {
  inherit,
  member,
  Policy,
  Role,
  sensMediumOrLower,
  sensOnlyLow,
} from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(
  [Role.FinancialAnalyst, Role.LeadFinancialAnalyst, Role.Controller],
  (r) => [
    r.Budget.read.when(member).edit,
    r.BudgetRecord.read.when(member).edit,
    r.Ceremony.read,
    r.Directory.read.when(member).edit,
    r.Education.read,
    inherit(
      r.Engagement.read
        .when(member)
        .create.delete.specifically((p) => [
          p.many('disbursementCompleteDate', 'status').when(member).edit,
        ]),
      r.LanguageEngagement.specifically((p) => [p.paratextRegistryId.none]),
    ),
    r.FieldRegion.read,
    r.FieldZone.read,
    r.FinancialReport.edit,
    r.FundingAccount.read,
    r.Language.read.specifically((p) => [
      p.locations.when(sensOnlyLow).read,
      p.many('registryOfDialectsCode', 'signLanguageCode').none,
    ]),
    r.Organization.create.whenAny(member, sensMediumOrLower).edit,
    r.Partner.read.create
      .specifically((p) => [
        p
          .many('organization', 'pointOfContact')
          .whenAny(member, sensMediumOrLower).read,
      ])
      .children((c) => c.posts.edit),
    r.Partnership.read
      .specifically((p) => [
        p.many('organization', 'partner').whenAny(member, sensMediumOrLower)
          .read,
      ])
      .when(member).edit.create.delete,
    r.Product.read,
    r.Project.read
      .specifically((p) => [
        p
          .many('rootDirectory', 'primaryLocation', 'otherLocations')
          .whenAny(member, sensMediumOrLower).read,
        p
          .many(
            'step',
            'mouStart',
            'mouEnd',
            'rootDirectory',
            'financialReportPeriod',
            'financialReportReceivedAt',
          )
          .when(member).edit,
      ])
      .children((c) => c.posts.edit),
    r.ProjectMember.read.when(member).edit.create.delete,
    r.PeriodicReport.read.when(member).edit,
    r.StepProgress.read,
    r.Unavailability.read,
    r.User.read.create,
  ],
)
export class FinancialAnalystPolicy {}
