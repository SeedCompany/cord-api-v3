import { member, Policy, Role } from '../util';

// Who may see and work a Global Translation Leader's goals and their quarterly
// progress entries (#3968). One class per `@Policy`, since each decorator
// takes one role list.
//
// Field Partner and Project Manager act on their OWN projects, so every grant
// is member-conditioned — the read too, which the goal repository applies as
// SQL so a non-member gets an empty plan rather than redacted rows. A progress
// entry is never deleted outright: a report says one thing about a goal and
// revising it is an edit, so there is no `delete` on `GtlGoalProgress`.
//
// Regional Director, Field Operations Director and Marketing oversee many
// projects and are not added as members, so their reads are global, matching
// their GTL report grants. Leadership already reads everything.

@Policy([Role.FieldPartner, Role.ProjectManager], (r) => [
  r.GtlGoal.when(member).read.create.edit.delete,
  r.GtlGoalProgress.when(member).read.create.edit,
])
export class GtlGoalsEditPolicy {}

@Policy(
  [Role.RegionalDirector, Role.FieldOperationsDirector, Role.Marketing],
  (r) => [r.GtlGoal.read, r.GtlGoalProgress.read],
)
export class GtlGoalsReadPolicy {}
