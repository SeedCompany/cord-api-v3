import { inherit, member, Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Intern, (r) => [
  r.Ceremony.when(member).read,
  inherit(
    r.Engagement.when(member).read,
    r.LanguageEngagement.specifically((p) => [p.paratextRegistryId.none]),
  ),
  r.Language.when(member).read.specifically(
    (p) =>
      p.many(
        'leastOfThese',
        'leastOfTheseReason',
        'name',
        'registryOfDialectsCode',
        'signLanguageCode',
        'sponsorEstimatedEndDate',
      ).none,
  ),
  r.Location.when(member).read.specifically(
    (p) => p.many('fundingAccount').none,
  ),
  r.PeriodicReport.when(member).read,
  r.Producible.when(member).read,
  r.Product.when(member).read,
  r.Project.when(member)
    .read.specifically((p) => [
      p.rootDirectory.edit,
      p.many(
        'departmentId',
        'marketingLocation',
        'marketingRegionOverride',
        'fieldRegion',
      ).none,
    ])
    .children((c) => c.posts.edit),
  r.ProjectMember.when(member).read,
  r.StepProgress.when(member).read,
  r.Unavailability.when(member).read,
  r.User.when(member).read,
])
export class InternPolicy {}
