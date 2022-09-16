import { member, Policy, Role, sensMediumOrLower, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.FinancialAnalyst, Role.LeadFinancialAnalyst], (r) => [
  r.Budget.read.when(member).edit,
  r.BudgetRecord.read.when(member).edit,
  r.Ceremony.read,
  r.Education.read,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FileNode.edit,
  r.Directory.read.when(member).edit,
  r.FundingAccount.read,
  r.Engagement.read.specifically((p) => [
    p.many('disbursementCompleteDate', 'status').when(member).edit,
  ]),
  r.Language.read.specifically((c) => c.locations.when(sensOnlyLow).read),
  r.Producible.read,
  r.Location.read,
  r.Organization.whenAny(member, sensMediumOrLower).edit.or.create,
  r.Partner.read.create
    .specifically((p) => [
      p.many('organization', 'pointOfContact').when(sensMediumOrLower).read,
    ])
    .children((c) => c.posts.edit),
  r.Partnership.read.specifically((p) => [
    p.financialReportingType.edit,
    p.partner.when(sensMediumOrLower).read, // same for org?
  ]),
  r.Post.edit,
  r.Product.read,
  r.Project.read
    .specifically((p) => [
      p
        .many('rootDirectory', 'primaryLocation', 'otherLocations')
        .when(sensMediumOrLower).read,
      p.financialReportPeriod.edit,
    ])
    .children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.PeriodicReport.read,
  r.User.read.create,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class FinancialAnalystPolicy {}
