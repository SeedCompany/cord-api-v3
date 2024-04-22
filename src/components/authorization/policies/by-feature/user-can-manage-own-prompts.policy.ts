import { creator, Policy } from '../util';

@Policy('all', (r) => [
  [
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
  ].map((it) => it.specifically((p) => p.prompt.when(creator).edit)),
])
export class UserCanManageOwnPromptsPolicy {}
