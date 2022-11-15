import { inherit, Policy, Role, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.StaffMember, (r) => [
  r.Ceremony.read,
  r.Education.read,
  inherit(
    r.Engagement.read,
    r.LanguageEngagement.specifically((p) => p.paratextRegistryId.none)
  ),
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Language.read.specifically((p) => [
    p.locations.when(sensOnlyLow).read,
    p.registryOfDialectsCode.none,
    p.signLanguageCode.none,
  ]),
  r.Organization.read.specifically((p) => [
    p.address.none,
    p.many('name', 'locations').when(sensOnlyLow).read,
  ]),
  r.Partner.when(sensOnlyLow)
    .read.specifically((p) => [p.pointOfContact.none, p.pmcEntityCode.none])
    .children((c) => c.posts.create.read),
  r.Partnership.when(sensOnlyLow).read,
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read
    .specifically((p) => [
      p.rootDirectory.none,
      p.many('otherLocations', 'primaryLocation').when(sensOnlyLow).read,
    ])
    .children((c) => c.posts.create.read),
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read,
])
export class StaffMemberPolicy {}
