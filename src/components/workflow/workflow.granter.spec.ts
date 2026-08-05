import { describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { EnhancedResource } from '~/common';
import { ProjectWorkflowEvent as Event } from '../project/workflow/dto';
import { ProjectWorkflow } from '../project/workflow/project-workflow';
import { ProjectWorkflowEventGranter } from '../project/workflow/project-workflow.granter';

/**
 * The shared transition condition, as SQL.
 *
 * Read the same caveat as the sibling spec in `progress-report/workflow` first:
 * this condition does NOT gate any read today. An action getter captures the
 * condition staged at that moment (`perm-granter.ts` `[action]`,
 * `stagedCondition ?? true`) and every policy writes `.read` before staging one,
 * so read resolves to a plain boolean and the staged condition governs the
 * following `execute`. Since `applyReadFilter` is the only caller of
 * `drizzleFilter` and always asks for `read`, nothing reaches the arm tested
 * here. Policies granting per-transition read that reads as if it were filtered:
 * `controller.policy.ts`, `regional-director.policy.ts`, `consultant.policy.ts`
 * and four more all have this shape.
 *
 * Worth pinning anyway, and more so than the sibling, because this class is
 * generic over the workflow. The sibling is private to one workflow and names its
 * column inline; this one is handed the column by the workflow definition and
 * threads it through construction, unioning and intersection. Every hand-off can
 * drop it, and dropping it is quiet — the SQL either names the wrong table (valid
 * SQL, wrong rows) or names nothing at all. The day a policy is written
 * condition-first (`.transitions(...).read`), this SQL is what stands between a
 * reader and events they were never granted.
 *
 * Assertions run against the workflow's own transition keys rather than literals,
 * so renaming a transition doesn't produce a puzzle here.
 */
describe('shared workflow transition condition, as SQL', () => {
  const dialect = new PgDialect();

  const granter = () =>
    new ProjectWorkflowEventGranter(EnhancedResource.of(Event));

  const drizzleArmOf = (condition: {
    asDrizzleCondition?: (...args: never[]) => unknown;
  }) => {
    if (!condition.asDrizzleCondition) {
      throw new Error('the transition condition has no Drizzle arm');
    }
    // Takes no arguments — the allowed keys come from the condition itself, not
    // from the reader's session.
    return condition.asDrizzleCondition() as Parameters<typeof sql>[0];
  };

  const render = (condition: Parameters<typeof drizzleArmOf>[0]) => {
    const query = dialect.sqlToQuery(sql`${drizzleArmOf(condition)}`);
    return { text: query.sql, params: query.params };
  };

  const keyOf = (name: string) =>
    ProjectWorkflow.transitionByName(name as never).key;

  it('names the project workflow event table, not another workflow’s', () => {
    // The failure this guards against: the generic condition reaching for a
    // column that belongs to a different workflow's event table. That produces
    // perfectly valid SQL against a table the query never joined.
    const { text } = render(granter().isTransitions('Approve Concept'));

    expect(text).toContain('"project_workflow_events"."transition_key"');
    expect(text).not.toContain('progress_report_workflow_events');
  });

  it('carries one parameter per allowed transition', () => {
    const one = render(granter().isTransitions('Approve Concept'));
    const two = render(
      granter().isTransitions(['Approve Concept', 'Reject Concept']),
    );

    expect(one.params).toEqual([keyOf('Approve Concept')]);
    expect(new Set(two.params)).toEqual(
      new Set([keyOf('Approve Concept'), keyOf('Reject Concept')]),
    );
  });

  it('uses `in`, so an event with no transition key does not match', () => {
    // `null in (…)` is NULL in Postgres, which a WHERE clause drops — the same
    // answer `isAllowed` gives for an event whose transition was bypassed or
    // resolved dynamically. A coalesce to true, or a negated form, would change
    // that, so assert the operator itself.
    const { text } = render(granter().isTransitions('Approve Concept'));

    expect(text.toLowerCase()).toContain(' in (');
  });

  it('renders false when the grant allows no transitions', () => {
    // Reachable through `isState` for a state nothing transitions to. Rendering
    // nothing here would widen the filter to everything; `isAllowed` answers
    // false, so the SQL has to as well.
    const condition = granter().isTransitions([]);
    expect(condition.allowedTransitionKeys.size).toBe(0);

    expect(render(condition).text.toLowerCase()).toContain('false');
  });

  it('keeps the column through union and intersection', () => {
    // Both combinators rebuild the condition, so both have to carry the column
    // forward. They are declared `this: void` and take the group as an argument.
    const concept = granter().isTransitions('Approve Concept');
    const reject = granter().isTransitions('Reject Concept');

    const unioned = concept.union([concept, reject]);
    const intersected = concept.intersect([concept, concept]);

    for (const combined of [unioned, intersected]) {
      expect(render(combined).text).toContain(
        '"project_workflow_events"."transition_key"',
      );
    }
    // Union widens rather than replaces.
    expect(new Set(render(unioned).params)).toEqual(
      new Set([keyOf('Approve Concept'), keyOf('Reject Concept')]),
    );
  });
});
