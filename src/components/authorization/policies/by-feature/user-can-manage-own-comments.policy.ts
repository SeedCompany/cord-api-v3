import { creator, Policy } from '../util';

@Policy('all', (r) => [
  // The author owns the content of their post, not its moderation. Clearing
  // the reach, finalizing the shown wording and curating it into the Investor
  // Report are someone else's decisions (ModeratePostsPolicy,
  // FeaturePostForInvestorReportPolicy), so they are carved out of the
  // object-level edit here — otherwise `edit` would fall through to them.
  r.Post.when(creator).edit.delete.specifically(
    (p) => p.many('approvedShareability', 'finalBody', 'featured').none,
  ),
  [r.CommentThread, r.Comment].map((it) => it.when(creator).edit.delete),
])
export class UserCanManageOwnCommentsPolicy {}
