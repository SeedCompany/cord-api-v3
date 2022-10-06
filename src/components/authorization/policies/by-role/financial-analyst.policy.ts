import { member, Policy, Role, sensMediumOrLower, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(
  [Role.FinancialAnalyst, Role.LeadFinancialAnalyst, Role.Controller],
  (r) => [
    r.Budget.read.when(member).edit,
    r.BudgetRecord.read.when(member).edit,
    r.Ceremony.read,
    r.Directory.read.when(member).edit,
    r.Education.read,
    r.Engagement.read
      .when(member)
      .create.delete.specifically((p) => [
        p.many('disbursementCompleteDate', 'status').when(member).edit,
      ]),
    r.EthnologueLanguage.read,
    r.FieldRegion.read,
    r.FieldZone.read,
    r.FundingAccount.read,
    r.Language.read.specifically((c) => c.locations.when(sensOnlyLow).read),
    r.Organization.whenAny(member, sensMediumOrLower).edit.or.create,
    r.Partner.read.create
      .specifically((p) => [
        p.many('organization', 'pointOfContact').when(sensMediumOrLower).read,
      ])
      .children((c) => c.posts.edit),
    r.Partnership.read
      .specifically((p) => [
        p.financialReportingType.edit,
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
        p.many('step', 'mouStart', 'mouEnd', 'rootDirectory').when(member).edit,
        p.financialReportPeriod.edit,
      ])
      .children((c) => c.posts.edit),
    r.ProjectMember.read.when(member).create.delete,
    r.PeriodicReport.read,
    r.StepProgress.read,
    r.Unavailability.read,
    r.User.read.create,
  ]
)
export class FinancialAnalystPolicy {}
