import { member, Policy, Role } from '../util';

// Who may choose which community story a progress report features (#3972).
//
// This is separate from writing the story itself: the field partner authors it,
// but which one goes forward to investors is Seed Company's call, so Field
// Partner gets no grant here. One class per `@Policy`, since each decorator
// takes one role list: project managers decide for their OWN projects, so
// theirs is member-conditioned; Marketing curates across projects, so theirs is
// global — the same split the by-role policies use for these roles' other
// community-story grants.

@Policy(Role.ProjectManager, (r) => [
  r.ProgressReportCommunityStory.when(member).specifically(
    (p) => p.featured.edit,
  ),
])
export class ProjectManagersFeatureCommunityStoryPolicy {}

@Policy(Role.Marketing, (r) => [
  r.ProgressReportCommunityStory.specifically((p) => p.featured.edit),
])
export class MarketingFeaturesCommunityStoryPolicy {}
