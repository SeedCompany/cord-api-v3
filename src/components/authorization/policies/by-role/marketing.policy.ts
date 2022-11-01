import { member, Policy, Role, sensMediumOrLower, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.Marketing], (r) => [
  r.Partner.when(sensOnlyLow)
    .read.whenAll(member, sensMediumOrLower)
    .read.specifically((p) => p.many('pmcEntityCode', 'pointOfContact').none)
    .children((c) => c.posts.edit),
  r.Project.specifically((p) => [
    p
      .many('rootDirectory', 'primaryLocation', 'otherLocations')
      .whenAny(member, sensOnlyLow).read,
    p.marketingLocation.edit,
  ]).children((c) => c.posts.edit),
])
export class MarketingPolicy {}
