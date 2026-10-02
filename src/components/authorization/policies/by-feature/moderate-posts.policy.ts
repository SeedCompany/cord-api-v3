import { Policy, Role } from '../util';

/**
 * Who may clear a post for sharing beyond Seed Company, and who may set the
 * wording it actually shows once it leaves the author's hands.
 *
 * Moderation is modelled as edit access to two properties rather than a
 * bespoke action:
 *
 * - `approvedShareability` — how far the post may actually reach. The service
 *   additionally refuses to clear a post wider than its author asked for;
 *   this policy only decides who may attempt it.
 * - `finalBody` — a translation or a moderator's touch-up. A separate field
 *   rather than edit access to `body`, so the author's own words are never
 *   silently lost to someone else's edit. See `effectiveBodyOf`.
 *
 * Reviewing a post for external reach and tightening its wording before it
 * goes out are usually the same pass by the same person, which is why one
 * roster covers both. Deliberately NOT `shareability.edit`, `type.edit` or
 * `body.edit` — those stay with the author.
 *
 * The roster is a list because who should own this is unsettled (Field
 * Project Manager, Regional Director, Marketing all have a claim); it can be
 * narrowed by editing this array with no schema or resolver churn.
 *
 * Deliberately NOT granted to Role.FieldPartner: a partner requests a reach,
 * someone else clears it. That separation is the whole point.
 */
@Policy(
  [
    Role.Translator,
    Role.ProjectManager,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
    Role.Marketing,
  ],
  (r) => [
    r.Post.specifically((p) => [p.approvedShareability.edit, p.finalBody.edit]),
  ],
)
export class ModeratePostsPolicy {}
