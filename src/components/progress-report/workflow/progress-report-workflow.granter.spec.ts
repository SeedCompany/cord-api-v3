import { describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { EnhancedResource } from '~/common';
import { ProgressReportWorkflowEvent as Event } from './dto/workflow-event.dto';
import { ProgressReportWorkflowEventGranter } from './progress-report-workflow.granter';
import { type TransitionName, Transitions } from './transitions';

/**
 * Read on a progress-report workflow event is granted per transition, so the
 * read filter the repository applies is only as good as the SQL this condition
 * produces. Two ways of getting it wrong are silent: naming the wrong column
 * gives valid SQL that filters nothing useful, and letting an event with no
 * transition match hands out rows that `isAllowed` refuses in memory.
 *
 * The Cypher and EdgeQL arms of this condition have carried a `transition IN …`
 * shape for a long time. This pins the Drizzle arm against them.
 */
describe('progress-report workflow transition condition, as SQL', () => {
  const dialect = new PgDialect();

  const conditionFor = (names: TransitionName[]) => {
    const granter = new ProgressReportWorkflowEventGranter(
      EnhancedResource.of(Event),
    );
    const condition = granter.isTransitions(names);
    if (!condition.asDrizzleCondition) {
      throw new Error('the transition condition has no Drizzle arm');
    }
    // Takes no params — the allowed ids come from the condition itself, not
    // from the reader's session.
    return condition.asDrizzleCondition();
  };

  const toSql = (names: TransitionName[]) => {
    const query = dialect.sqlToQuery(sql`${conditionFor(names)}`);
    return { text: query.sql, params: query.params };
  };

  it('filters on the transition column, not the status or the event id', () => {
    const { text } = toSql(['Start']);
    expect(text).toContain('"transition_key"');
    expect(text).not.toContain('"status"');
    expect(text).not.toMatch(/"progress_report_workflow_events"\."id"/);
  });

  it('carries one parameter per allowed transition', () => {
    const one = toSql(['Start']);
    const two = toSql(['Start', 'Publish']);

    expect(one.params).toEqual([Transitions.Start.id]);
    expect(two.params).toHaveLength(2);
    expect(new Set(two.params)).toEqual(
      new Set([Transitions.Start.id, Transitions.Publish.id]),
    );
  });

  it('uses `in`, so an event with no transition does not match', () => {
    // `null in (…)` is NULL in Postgres, which a WHERE clause drops — the same
    // answer `isAllowed` gives for an event with no transition. A coalesce to
    // true, or a negated form, would change that, so assert the operator.
    expect(toSql(['Start']).text.toLowerCase()).toContain(' in (');
  });
});
