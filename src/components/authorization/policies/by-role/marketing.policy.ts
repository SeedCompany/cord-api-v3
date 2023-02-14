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
  // This is only here to allow the children connections below to work.
  // I think the builder should be updated to be able to infer this automatically.
  r.ProgressReport,
  [
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
  ].flatMap((it) => [
    it.read.specifically((p) => [p.responses.when(variant('published')).edit]),
  ]),
  r.ProgressReportVarianceExplanation.read.specifically((p) => p.comments.none),
  r.ProgressReportWorkflowEvent.read.transitions('Publish').execute,
  r.Project.read
    .specifically((p) => [
      p
        .many('rootDirectory', 'primaryLocation', 'otherLocations')
        .whenAny(member, sensOnlyLow).read,
      p.marketingLocation.edit,
    ])
    .children((c) => c.posts.edit),
])
export class MarketingPolicy {}
