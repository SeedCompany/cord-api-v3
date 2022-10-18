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
        .whenAny(member, sensMediumOrLower).read
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
    p.partner.whenAny(member, sensOnlyLow).read,
    p.organization.whenAny(member, sensOnlyLow).read,
    // clean up above
  ]),
  r.Project.read
    .specifically((p) => [
      p.step.edit,
      p.stepChangedAt.edit,
      p.rootDirectory.whenAny(member, sensMediumOrLower).edit,
      p.primaryLocation.whenAny(member, sensMediumOrLower).read,
      p.financialReportReceivedAt.whenAny(member, sensMediumOrLower).read,
      p.financialReportPeriod.whenAny(member, sensMediumOrLower).read,
      p.sensitivity.whenAny(member, sensMediumOrLower).read,
      p.otherLocations.whenAny(member, sensMediumOrLower).read,
    ])
    // clean up above
    .children((c) => [c.posts.edit]),
  r.ProjectMember.edit,
])
export class ConsultantManagerPolicy {}
