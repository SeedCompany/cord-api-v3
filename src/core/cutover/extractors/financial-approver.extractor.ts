import { type ID } from '~/common';
import {
  financialApprovers,
  projectTypeEnum,
  users,
} from '~/core/drizzle/schema';
import { type ProjectType } from '../../../components/project/dto/project-type.enum';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  sanitizeEnum,
  stat,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * ProjectTypeFinancialApprover — finance-approver config ("user X approves
 * finances for project type Y"), read by the project workflow to notify
 * approvers on financial-plan transitions. Ported, not retired, per Rob
 * 2026-08-24: without it those notifications silently stop at cutover.
 *
 * The source node holds ONLY the projectTypes array — no id, no timestamps —
 * and is merged one-per-user, so the user id is the row identity (and the
 * table's primary key). The edge target is matched label-free and classified
 * in code, so an approver pointing at a soft-deleted or never-landed user is a
 * logged drop, not a silent Cypher filter.
 */
interface Row {
  userId: ID<'User'>;
  // Raw from Cypher: a field Neo4j never wrote arrives null, and values are
  // only trusted after sanitizeEnum — an unrecognised one would otherwise
  // fail the enum cast and abort the whole load.
  projectTypes: readonly string[] | null;
}

export const financialApproverExtractor: Extractor = {
  name: 'financial-approver',
  targetTables: ['financial_approvers'],
  dependsOn: ['user'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const landedUsers = await liveTargetIds(ctx, 'User', users);

    const rows = await cypher<Row>(
      ctx,
      `MATCH (n:ProjectTypeFinancialApprover)-[:financialApprover { active: true }]->(user)
       RETURN user.id AS userId, n.projectTypes AS projectTypes`,
    );

    const kept = keepLanded(rows, [[landedUsers, (row) => row.userId]]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} financial approver(s) whose user never landed`,
      );
    }

    // Sanitize before the enum cast and the non-empty CHECK get a say — a bad
    // legacy value or an empty/absent array would abort the whole run here.
    // An empty list means "no row" (the write path models it as a delete).
    const usable: Array<{
      userId: ID<'User'>;
      projectTypes: readonly [ProjectType, ...ProjectType[]];
    }> = [];
    const droppedValues: string[] = [];
    let droppedEmpty = 0;
    for (const row of kept.kept) {
      const types = sanitizeEnum(
        [...(row.projectTypes ?? [])],
        projectTypeEnum.enumValues,
      );
      droppedValues.push(...types.dropped);
      const [firstType, ...restTypes] = types.kept;
      if (firstType === undefined) {
        droppedEmpty++;
        continue;
      }
      usable.push({
        userId: row.userId,
        projectTypes: [firstType, ...restTypes],
      });
    }
    if (droppedValues.length > 0) {
      ctx.log(
        `    ⚠ dropped ${droppedValues.length} unrecognised project type value(s): ` +
          droppedValues.join(', '),
      );
    }
    if (droppedEmpty > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedEmpty} financial approver(s) with no valid project types — ` +
          `an empty list means no row, matching the write path's delete-on-empty`,
      );
    }

    out.financial_approvers = stat(
      rows.length,
      await bulkInsert(ctx, financialApprovers, usable),
    );

    return out;
  },
};
