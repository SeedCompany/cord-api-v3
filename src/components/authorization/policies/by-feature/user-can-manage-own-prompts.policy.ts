import { owner, Policy } from '../util';

@Policy('all', (r) => [
  r.ProgressReportCommunityStory.specifically((p) => p.prompt.when(owner).edit),
  r.ProgressReportHighlight.specifically((p) => p.prompt.when(owner).edit),
])
export class UserCanManageOwnPromptsPolicy {}
