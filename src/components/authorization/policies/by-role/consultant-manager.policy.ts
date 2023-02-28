import { member, Policy, Role, sensMediumOrLower, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.ConsultantManager, (r) => [
  r.Budget.whenAny(member, sensMediumOrLower).read,
  r.BudgetRecord.whenAny(member, sensMediumOrLower).read,
  r.Education.read,
  r.EthnologueLanguage.when(sensMediumOrLower).read,
  r.FundingAccount.read,
  r.Language.read.specifically(
    (p) =>
      p
        .many('registryOfDialectsCode', 'signLanguageCode', 'locations')
        .whenAny(member, sensMediumOrLower).read,
  ),
  r.LanguageEngagement.edit.specifically((p) => [
    p.paratextRegistryId.whenAny(member, sensMediumOrLower).edit,
  ]),
  r.Organization.read.specifically((p) => [
    p.address.none,
    p.locations.when(sensMediumOrLower).read,
  ]),
  r.Partner.read
    .specifically((p) => p.pointOfContact.none)
    .children((r) => r.posts.edit),
  r.Partnership.read.specifically((p) => [
    p.many('partner', 'organization').whenAny(member, sensOnlyLow).read,
  ]),
  r.Project.read
    .specifically((p) => [
      p.many('step', 'stepChangedAt').edit,
      p
        .many(
          'financialReportPeriod',
          'financialReportReceivedAt',
          'otherLocations',
          'primaryLocation',
          'sensitivity',
        )
        .whenAny(member, sensMediumOrLower).read,
      p.rootDirectory.whenAny(member, sensMediumOrLower).edit,
    ])
    .children((c) => [c.posts.edit]),
  r.ProjectMember.edit.create.delete,
])
export class ConsultantManagerPolicy {}
