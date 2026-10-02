import { describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { EnhancedResource } from '~/common';
import { GtlReportWorkflowEvent as Event } from './dto';
import { GtlReportWorkflow } from './gtl-report-workflow';
import { GtlReportWorkflowEventGranter } from './gtl-report-workflow.granter';

type TransitionName = (typeof GtlReportWorkflow)['transition']['name'];

/**
 * The per-transition condition for GTL report events, as SQL.
 *
 * The shared `TransitionCondition` is generic over the workflow and is handed
 * its column by the workflow definition. The one thing that can go wrong per
 * workflow is that hand-off: the condition naming another workflow's event
 * table (valid SQL, wrong rows) or no table at all. Pin it here, against this
 * workflow's own keys rather than literals, so renaming a transition does not
 * turn into a puzzle.
 */
describe('GTL report workflow transition condition, as SQL', () => {
  const dialect = new PgDialect();

  const granter = () =>
    new GtlReportWorkflowEventGranter(EnhancedResource.of(Event));

  const render = (names: TransitionName[]) => {
    const condition = granter().isTransitions(names);
    if (!condition.asDrizzleCondition) {
      throw new Error('the transition condition has no Drizzle arm');
    }
    // Takes no arguments — the allowed keys come from the condition itself,
    // not from the reader's session.
    const query = dialect.sqlToQuery(sql`${condition.asDrizzleCondition()}`);
    return { text: query.sql, params: query.params };
  };

  const keyOf = (name: TransitionName) =>
    GtlReportWorkflow.transitionByName(name).key;

  it('names the GTL report event table, not a sibling workflow’s', () => {
    const { text } = render(['Start']);

    expect(text).toContain('"gtl_report_workflow_events"."transition_key"');
    expect(text).not.toContain('progress_report_workflow_events');
    expect(text).not.toContain('project_workflow_events');
  });

  it('carries one parameter per allowed transition', () => {
    const one = render(['Start']);
    const two = render(['Start', 'Publish']);

    expect(one.params).toEqual([keyOf('Start')]);
    expect(new Set(two.params)).toEqual(
      new Set([keyOf('Start'), keyOf('Publish')]),
    );
  });

  it('uses `in`, so a bypass event (no transition key) does not match', () => {
    // `null in (…)` is NULL in Postgres, which a WHERE clause drops — the same
    // answer `isAllowed` gives for an event whose workflow was bypassed.
    expect(render(['Start']).text.toLowerCase()).toContain(' in (');
  });

  it('renders false when the grant allows no transitions', () => {
    // An empty allowed set must DENY; rendering nothing would widen the filter
    // to every row.
    expect(render([]).text.toLowerCase()).toContain('false');
  });
});
