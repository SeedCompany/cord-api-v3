-- Financial approvers: "user X approves finances for project type Y" — read by
-- the project workflow to notify approvers on five financial-plan transitions
-- (the FinancialApprovers notifier). Ported, not retired, per Rob 2026-08-24:
-- without this table those notifications silently stop at cutover. 3 rows in
-- production.
--
-- Neo4j models this as a ProjectTypeFinancialApprover node holding ONLY a
-- projectTypes array, linked -[:financialApprover]-> User and merged
-- one-per-user (Gel likewise makes the link exclusive). The node has no id and
-- no timestamps, so the user is the row identity — hence user_id as the
-- primary key and no id/created_at columns to carry.

CREATE TABLE "financial_approvers" (
  "user_id"        text PRIMARY KEY REFERENCES "users"("id"),
  "project_types"  "project_type"[] NOT NULL,
  -- An approver with no project types is a delete, not a row — the write path
  -- removes the row when the list empties (matching Neo4j's detachDelete), so
  -- the empty state is meaningless and the database refuses it outright.
  CONSTRAINT "financial_approvers_types_not_empty"
    CHECK (cardinality("project_types") > 0)
);
