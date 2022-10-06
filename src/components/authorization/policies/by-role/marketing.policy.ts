import { member, Policy, Role, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Marketing, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Education.read,
  r.EthnologueLanguage.when(sensOnlyLow).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.InternshipEngagement.edit,
  r.LanguageEngagement.read,
  r.Language.read.specifically((p) => [
    p.registryOfDialectsCode.when(sensOnlyLow).read,
    p.signLanguageCode.when(sensOnlyLow).read,
    p.locations.whenAny(member, sensOnlyLow).read,
  ]),
  r.Organization.whenAny(member, sensOnlyLow).read.specifically((p) => [
    p.address.none,
    p.locations.when(sensOnlyLow).read,
  ]),
  r.Partner.whenAny(member, sensOnlyLow)
    .read.specifically((p) => [p.pointOfContact.none, p.pmcEntityCode.none])
    .children((c) => c.posts.edit),
  r.Partnership.read.specifically((p) => [
    // TODO this is same as above. Inherit single relation perms automatically. Only read action I guess
    p.organization.whenAny(member, sensOnlyLow).read,
    p.partner.whenAny(member, sensOnlyLow).read,
  ]),
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read
    .specifically((p) => [
      p
        .many('rootDirectory', 'primaryLocation', 'otherLocations')
        .whenAny(member, sensOnlyLow).read,
      p.marketingLocation.edit,
    ])
    .children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read.create,
  r.User.read.create,
])
export class MarketingPolicy {}
