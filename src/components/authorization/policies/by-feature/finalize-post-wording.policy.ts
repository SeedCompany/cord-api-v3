import { Policy, Role } from '../util';

/**
 * Who may set the wording a post actually shows once it leaves the author's
 * hands — a translation, a moderator's touch-up, or both.
 *
 * A separate field (`finalBody`) rather than letting these roles edit `body`
 * directly, for the same reason `approvedShareability` sits beside
 * `shareability`: the author's own words should never be silently lost to
 * someone else's edit. See `effectiveBodyOf` for which one to read.
 *
 * Role.Translator is the primary case — a partner writes in their own
 * language, someone renders it for an English-speaking audience. The same
 * moderator roster as ModeratePostsPolicy is included too: reviewing a post
 * for external reach and tightening its wording before it goes out are often
 * the same pass, done by the same person. Deliberately NOT `shareability.edit`
 * or `type.edit` — producing the shown wording is a different decision from
 * clearing the reach or changing what kind of post this is.
 *
 * Deliberately NOT granted to Role.FieldPartner: this field exists precisely
 * for wording someone *other than* the author produces.
 */
@Policy(
  [
    Role.Translator,
    Role.ProjectManager,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
    Role.Marketing,
  ],
  (r) => [r.Post.specifically((p) => p.finalBody.edit)],
)
export class FinalizePostWordingPolicy {}
