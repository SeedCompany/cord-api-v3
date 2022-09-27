import { member, Policy, Role, sensMediumOrLower, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.ConsultantManager, (r) => [
  r.Budget.whenAny(member, sensMediumOrLower).read,
  r.BudgetRecord.whenAny(member, sensMediumOrLower).read,
  r.Ceremony.read,
  r.FileNode.edit,
  r.Education.read,
  r.EthnologueLanguage.whenAny(member, sensMediumOrLower).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Language.read.specifically((p) => [
    p.registryOfDialectsCode.when(sensMediumOrLower).read,
    p.signLanguageCode.when(sensMediumOrLower).read,
    p.locations.when(sensMediumOrLower).read,
  ]),
  r.Engagement.edit,
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
  ]),
  r.Post.edit.delete,
  r.Product.read,
  r.Project.read
    .specifically((p) => [
      p.step.edit,
      p.stepChangedAt.edit,
      p.rootDirectory.whenAny(member, sensMediumOrLower).edit,
      p.primaryLocation.whenAny(member, sensMediumOrLower).read,
      p.financialReportReceivedAt.edit,
      p.financialReportPeriod.edit,
      p.sensitivity.whenAny(member, sensMediumOrLower).edit,
      p.otherLocations.whenAny(member, sensMediumOrLower).read,
    ])
    .children((c) => [c.posts.edit]),
  r.ProjectMember.edit,
  r.PeriodicReport.read,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class ConsultantManagerPolicy {}
