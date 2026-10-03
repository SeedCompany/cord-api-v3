import { creator, Policy } from '../util';

// Two lists rather than one: the granter types only collapse into one when
// the resources are structurally identical, and the GTL sections' `Parent`
// differs from the Progress Report sections'.
@Policy('all', (r) => [
  [
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
    r.ProgressReportOtherActivities,
    r.ProgressReportNextQuarterPlans,
  ].map((it) => it.specifically((p) => p.prompt.when(creator).edit)),
  [r.GtlReportCommunityImpact, r.GtlReportHighlight].map((it) =>
    it.specifically((p) => p.prompt.when(creator).edit),
  ),
])
export class UserCanManageOwnPromptsPolicy {}
