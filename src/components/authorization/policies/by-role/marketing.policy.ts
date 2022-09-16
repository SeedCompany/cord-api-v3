import { member, Policy, Role, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Marketing, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.FileNode.edit.create,
  r.Education.read,
  r.EthnologueLanguage.when(sensOnlyLow).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Producible.read,
  r.InternshipEngagement.edit,
  r.LanguageEngagement.read,
  r.Language.read.specifically((p) => [
    p.registryOfDialectsCode.when(sensOnlyLow).read,
    p.signLanguageCode.when(sensOnlyLow).read,
    p.locations.whenAny(member, sensOnlyLow).read,
  ]),
  r.Location.read,
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
  r.Post.edit,
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
  r.PeriodicReport.read,
  r.User.read.create,
  r.Unavailability.read.create,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class MarketingPolicy {}
