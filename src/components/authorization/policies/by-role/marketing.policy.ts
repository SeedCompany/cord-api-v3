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
  [
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
  ].flatMap((it) => [
    it.read.specifically((p) => [
      p.responses.when(variant('published')).read,
      p.responses.whenAll(sensMediumOrLower, variant('fpm')).read,
      p.responses.when(member).read,
      p.responses.whenAll(member, variant('published')).edit,
    ]),
  ]),
  r.ProgressReportVarianceExplanation.read,
  r.ProgressReportWorkflowEvent.transitions('Publish').execute,
  r.Project.read
    .specifically((p) => [
      p
        .many('rootDirectory', 'primaryLocation', 'otherLocations')
        .whenAny(member, sensOnlyLow).read,
      p.marketingLocation.edit,
    ])
    .children((c) => c.posts.edit),
  r.StepProgress.whenAll(sensOnlyLow, variant('official')).read,
])
export class MarketingPolicy {}
