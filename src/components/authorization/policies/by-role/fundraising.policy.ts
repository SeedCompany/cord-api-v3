import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Fundraising, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Directory.read,
  r.Education.read,
  r.Engagement.read,
  r.EthnologueLanguage.whenAny(member, sensMediumOrLower).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.File.read,
  r.FileVersion.read,
  r.FundingAccount.read,
  r.Language.read.specifically((p) => [
    p.registryOfDialectsCode.whenAny(member, sensMediumOrLower).read,
    p.signLanguageCode.whenAny(member, sensMediumOrLower).read,
    p.locations.whenAny(member, sensMediumOrLower).read,
  ]),
  r.Organization.whenAny(member, sensMediumOrLower).read.specifically((p) => [
    p.address.none,
  ]),
  r.Partner.when(sensMediumOrLower)
    .read.specifically((p) => p.pointOfContact.none)
    .children((c) => c.posts.edit),
  r.Partnership.read.specifically((p) => [
    p.many('organization', 'partner').whenAny(member, sensMediumOrLower).read,
  ]),
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read
    .specifically((p) => [
      p
        .many('rootDirectory', 'primaryLocation', 'otherLocations')
        .whenAny(member, sensMediumOrLower).read,
    ])
    .children((c) => c.posts.when(member).edit),
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read,
])
export class FundraisingPolicy {}
