import { type ID } from '~/common';
import {
  budgetRecords,
  budgets,
  budgetStatusEnum,
  organizations,
  projects,
} from '~/core/drizzle/schema';
import { isBaseNode } from '~/core/neo4j/results';
import { BudgetRepository } from '../../../components/budget/budget.repository';
import { type Budget, type BudgetStatus } from '../../../components/budget/dto';
import {
  bulkInsert,
  cypher,
  linkId,
  liveTargetIds,
  readAllViaRepo,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Budget + BudgetRecord. Budgets read through the repo's proven readMany;
 * records go pure Cypher — `BudgetRecordRepository`'s hydrate requires a bound
 * `project` variable (its inherited readMany can't run standalone) and the
 * record props are plain Property nodes, so an explicit per-prop match is the
 * whole hydrate. `universal_template_file_id` is a deferred FK (plain text) —
 * the Neo4j file ID carries over now and becomes a real reference when the
 * File wave migrates `file_nodes` with the same IDs (same as
 * partnerships.mou_id).
 *
 * Changeset-pending record values are NOT carried — reads are live-view only,
 * consistent with every other extractor (changesets don't migrate).
 */
export const budgetExtractor: Extractor = {
  name: 'budget',
  targetTables: ['budgets', 'budget_records'],
  dependsOn: ['project', 'organization'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const dtos = await readAllViaRepo<Budget>(ctx, 'Budget', BudgetRepository);

    const statuses = budgetStatusEnum.enumValues as readonly string[];
    const unknownStatuses = new Set<string>();
    const statusOr = (value: string | null | undefined): BudgetStatus => {
      if (value && statuses.includes(value)) {
        // Runtime-validated against the pgEnum just above.
        return value as BudgetStatus;
      }
      if (value) unknownStatuses.add(value);
      return 'Pending' as BudgetStatus;
    };

    // Prod-finding #2 guard: project_id is NOT NULL — drop dangling rows + log.
    const liveProjects = await liveTargetIds(ctx, 'Project', projects);
    let droppedDangling = 0;

    const budgetRows = dtos.flatMap((dto) => {
      // `parent` is the raw project node (readMany merges the Cypher variable
      // directly), so the id sits under `properties`. This extractor only ever
      // reads through the Neo4j repo, so it's always a raw node here — the
      // `BaseNode | LinkToUnknown` union on the DTO type is for other engines.
      if (!isBaseNode(dto.parent)) {
        throw new Error(
          `Expected budget ${dto.id}'s parent to be a raw Neo4j node`,
        );
      }
      const projectId = dto.parent.properties.id;
      if (!projectId || !liveProjects.has(projectId)) {
        droppedDangling++;
        return [];
      }
      return [
        {
          id: dto.id,
          projectId,
          status: statusOr(dto.status),
          // Deferred FK — File wave makes it real (IDs are preserved).
          universalTemplateFileId: linkId(dto.universalTemplateFile),
          createdAt: tsReq(dto.createdAt),
          updatedAt: tsReq(dto.createdAt),
          deletedAt: null,
        },
      ];
    });
    if (unknownStatuses.size) {
      ctx.log(
        `    ⚠ defaulted unknown budget status value(s) to Pending: ${[
          ...unknownStatuses,
        ].join(', ')} — migration-todo: map, don't default`,
      );
    }
    if (droppedDangling) {
      ctx.log(
        `    ⚠ dropped ${droppedDangling} budget(s) with dangling project refs (NOT NULL FK — prod-finding #2)`,
      );
    }
    out.budgets = stat(dtos.length, await bulkInsert(ctx, budgets, budgetRows));

    // Records: guard budget_id against what THIS run just mapped (a dropped
    // budget drops its records), organization_id against PG truth.
    const insertedBudgetIds = new Set<string>(budgetRows.map((row) => row.id));
    const liveOrgs = await liveTargetIds(ctx, 'Organization', organizations);

    const records = await cypher<{
      id: ID<'BudgetRecord'>;
      budgetId: ID<'Budget'>;
      organizationId: ID<'Organization'> | null;
      fiscalYear: number | null;
      amount: number | null;
      initialAmount: number | null;
      preApprovedAmount: number | null;
      createdAt: string;
    }>(
      ctx,
      `MATCH (budget:Budget)-[:record {active: true}]->(node:BudgetRecord)
       OPTIONAL MATCH (node)-[:organization {active: true}]->(org:Organization)
       OPTIONAL MATCH (node)-[:fiscalYear {active: true}]->(fy:Property)
       OPTIONAL MATCH (node)-[:amount {active: true}]->(amount:Property)
       OPTIONAL MATCH (node)-[:initialAmount {active: true}]->(initial:Property)
       OPTIONAL MATCH (node)-[:preApprovedAmount {active: true}]->(pre:Property)
       RETURN node.id AS id, budget.id AS budgetId, org.id AS organizationId,
              toFloat(fy.value) AS fiscalYear, toFloat(amount.value) AS amount,
              toFloat(initial.value) AS initialAmount,
              toFloat(pre.value) AS preApprovedAmount,
              toString(node.createdAt) AS createdAt`,
    );

    let droppedDanglingRecords = 0;
    let droppedNullFiscalYear = 0;
    const recordRows = records.flatMap((rec) => {
      if (
        !insertedBudgetIds.has(rec.budgetId) ||
        !rec.organizationId ||
        !liveOrgs.has(rec.organizationId)
      ) {
        droppedDanglingRecords++;
        return [];
      }
      if (rec.fiscalYear == null) {
        // NOT NULL with no sensible default (and part of the partial unique).
        droppedNullFiscalYear++;
        return [];
      }
      return [
        {
          id: rec.id,
          budgetId: rec.budgetId,
          organizationId: rec.organizationId,
          fiscalYear: Math.round(rec.fiscalYear),
          amount: rec.amount,
          initialAmount: rec.initialAmount,
          preApprovedAmount: rec.preApprovedAmount,
          createdAt: tsReq(rec.createdAt),
          updatedAt: tsReq(rec.createdAt),
          deletedAt: null,
        },
      ];
    });
    if (droppedDanglingRecords) {
      ctx.log(
        `    ⚠ dropped ${droppedDanglingRecords} budget record(s) with dangling budget/organization refs (NOT NULL FKs — prod-finding #2)`,
      );
    }
    if (droppedNullFiscalYear) {
      ctx.log(
        `    ⚠ dropped ${droppedNullFiscalYear} budget record(s) with no fiscalYear property (NOT NULL, no default — prod-finding #1 class)`,
      );
    }
    out.budget_records = stat(
      records.length,
      await bulkInsert(ctx, budgetRecords, recordRows),
    );

    return out;
  },
};
