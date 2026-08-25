import { Policy, Role } from '../util';

/**
 * Who may clear a post for sharing beyond Seed Company.
 *
 * Moderation is modelled as edit access to a single property —
 * `approvedShareability` — rather than a bespoke action. A moderator is doing
 * exactly one thing: setting how far a post may actually reach. Everything else
 * about the post stays under its author's control.
 *
 * The set of roles is deliberately a list rather than a single hardcoded role.
 * Who should own this is genuinely unsettled: the Field Project Manager is
 * closest to the sensitivity context and knows who is at risk; the Regional
 * Director is a smaller group with a broader view; Marketing is already the
 * external gate for report content, though presentation judgement is not safety
 * judgement. The people doing this job today are regional coordinators, and
 * their answer should probably win.
 *
 * Keeping it a list means that decision can change by editing this array, with
 * no schema or resolver churn. Start broad enough that nothing is blocked while
 * it is being settled, and narrow it once Field Ops has decided.
 *
 * Deliberately NOT granted to Role.FieldPartner: a partner requests a reach,
 * someone else clears it. That separation is the whole point.
 */
@Policy(
  [
    Role.ProjectManager,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
    Role.Marketing,
  ],
  (r) => [r.Post.specifically((p) => p.approvedShareability.edit)],
)
export class ModeratePostsPolicy {}
