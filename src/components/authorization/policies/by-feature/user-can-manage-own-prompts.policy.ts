import { creator, Policy } from '../util';

@Policy('all', (r) => [
  [
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
    r.ProgressReportOtherActivities,
    r.ProgressReportNextQuarterPlans,
  ].map((it) => it.specifically((p) => p.prompt.when(creator).edit)),
])
export class UserCanManageOwnPromptsPolicy {}
