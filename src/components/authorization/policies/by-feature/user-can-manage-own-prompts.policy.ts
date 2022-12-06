import { owner, Policy } from '../util';

@Policy('all', (r) => [
  [r.ProgressReportCommunityStory, r.ProgressReportHighlight].map((it) =>
    it.specifically((p) => p.prompt.when(owner).edit)
  ),
])
export class UserCanManageOwnPromptsPolicy {}
