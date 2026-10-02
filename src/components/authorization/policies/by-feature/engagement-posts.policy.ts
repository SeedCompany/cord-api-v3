import { member, Policy, Role } from '../util';

// Who may read and write posts (prayer requests, notes, stories) on an
// engagement — the feed shared by the Progress and GTL reports (#3964). One
// class per `@Policy`, since each decorator takes one role list.
//
// Why a by-feature file rather than a line in each role policy: the engine
// only copies an `r.Engagement` grant onto LanguageEngagement and
// InternshipEngagement when the SAME policy has no entry of its own for that
// concrete type, and several role policies do (Marketing names
// InternshipEngagement; the intern, mentor and consultant policies name
// LanguageEngagement). Kept here, each policy mentions only the interface, so
// the grant reaches both concrete types.
//
// Child-relation grants never fall back to object-level ones, so the existing
// `r.Engagement.when(member).edit` grants do NOT cover `posts`; the edge has
// to be named.
//
// Member roles act on their own projects, so their grants are
// member-conditioned — the author's own Membership posts are additionally
// hidden from non-members by the repository's SQL filter. Regional Director,
// Field Operations Director and Marketing oversee many projects and are not
// added as members, so their reads are global, matching their report grants.

@Policy(
  [
    Role.ProjectManager,
    Role.Translator,
    Role.Consultant,
    Role.Intern,
    Role.Mentor,
    Role.FieldPartner,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
  ],
  (r) => [r.Engagement.children((c) => c.posts.when(member).read.create)],
)
export class EngagementPostsMemberPolicy {}

@Policy(
  [Role.Marketing, Role.RegionalDirector, Role.FieldOperationsDirector],
  (r) => [r.Engagement.children((c) => c.posts.read)],
)
export class EngagementPostsReadPolicy {}
