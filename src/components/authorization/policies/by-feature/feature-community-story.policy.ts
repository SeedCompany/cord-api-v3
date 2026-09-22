import { Policy, Role } from '../util';

/**
 * Who may choose which community story represents a report to investors.
 *
 * Modelled as edit access to a single property — `featured` — the same shape
 * as `ModeratePostsPolicy` for post shareability: one decision, one field,
 * nothing else about the story changes.
 *
 * Deliberately NOT granted to Role.FieldPartner. A partner can write several
 * stories, but choosing which one goes to investors is the same kind of call
 * as approving a post for external sharing — a Seed Company judgement about
 * what best represents the quarter, not the author's to make.
 *
 * ProjectManager and Marketing specifically: the FPM is closest to the
 * report's content, and Marketing already owns the Investor Communications
 * variant this selection feeds. Adjust this list rather than the mechanism if
 * that ownership turns out to sit elsewhere.
 */
@Policy([Role.ProjectManager, Role.Marketing], (r) => [
  r.ProgressReportCommunityStory.specifically((p) => p.featured.edit),
])
export class FeatureCommunityStoryPolicy {}
