import {
  member,
  Policy,
  Role,
  sensMediumOrLower,
  sensOnlyLow,
  variant,
} from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.Marketing], (r) => [
  r.Organization.whenAny(member, sensOnlyLow).read.specifically((p) => [
    p.address.none,
    p.locations.when(sensOnlyLow).read,
  ]),
  r.Partner.when(sensOnlyLow)
    .read.whenAll(member, sensMediumOrLower)
    .read.specifically((p) => p.many('pmcEntityCode', 'pointOfContact').none)
    .children((c) => c.posts.edit),
  r.ProgressReport.when(member).edit,
  r.ProgressReportCommunityStory.when(variant('published'))
    .read.whenAll(sensMediumOrLower, variant('fpm'))
    .read.when(member)
    .read.specifically((p) => [
      p.responses.whenAll(member, variant('draft', 'fpm', 'published')).read,
      p.responses.whenAll(member, variant('published')).edit,
    ]),
  r.ProgressReportHighlight.when(variant('published'))
    .read.whenAll(sensMediumOrLower, variant('fpm'))
    .read.when(member)
    .read.specifically((p) => [
      p.responses.whenAll(member, variant('draft', 'fpm', 'published')).read,
      p.responses.whenAll(member, variant('published')).edit,
    ]),
  r.Project.read
    .specifically((p) => [
      p
        .many('rootDirectory', 'primaryLocation', 'otherLocations')
        .whenAny(member, sensOnlyLow).read,
      p.marketingLocation.edit,
    ])
    .children((c) => c.posts.edit),
  r.StepProgress.whenAll(member, variant('official')).read,
])
export class MarketingPolicy {}
