import { Policy, Role } from '../util';

/**
 * Who may curate a post into this quarter's Investor Report.
 *
 * A distinct decision from ModeratePostsPolicy's `approvedShareability.edit`:
 * that answers "may this leave Seed Company at all", this answers "is this
 * specific request one of the ones we're actually publishing this quarter".
 * PostService additionally enforces that the post is attached to a report,
 * cleared to at least `AskToShareExternally`, and within the per-report cap
 * before this can be set true — this policy only decides who may attempt it.
 *
 * Deliberately NOT granted to Role.FieldPartner: an author can ask to share
 * widely, but choosing what actually appears in the investor-facing document
 * is Seed Company's call, not the author's.
 */
@Policy([Role.ProjectManager, Role.Marketing], (r) => [
  r.Post.specifically((p) => p.featured.edit),
])
export class FeaturePostForInvestorReportPolicy {}
