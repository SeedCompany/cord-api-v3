import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  fileNodes,
  pnpExtractionResultProblems,
  pnpExtractionResults,
} from '~/core/drizzle/schema';
import {
  type PnpExtractionResult,
  PnpProblemSeverity,
  PnpProblemType,
  type StoredProblem,
} from './extraction-result.dto';
import { type PnpExtractionResultLoadResult } from './pnp-extraction-result.loader';

const severityOrder = [...PnpProblemSeverity.values];
const severityIndex = (typeId: string): number => {
  const severity = PnpProblemType.types.get(typeId as never)?.severity;
  return severity ? severityOrder.indexOf(severity) : 99;
};

/**
 * Postgres/Drizzle implementation of PnpExtractionResultRepository.
 * Results are keyed by File (the FileVersion's parent); problems live in a child
 * table. Severity + rendering come from PnpProblemType in code, so no types
 * table. migration-todo (cutover): drop alongside the Neo4j repository.
 *
 * migration-todo: the LanguageEngagement-list pnp filters/sorters (hasError /
 * totalErrors) aren't ported — add when a postgres engagement-list-by-pnp-error
 * path needs them.
 */
@Injectable()
export class PnpExtractionResultDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async read(
    files: ReadonlyArray<ID<'File'>>,
  ): Promise<readonly PnpExtractionResultLoadResult[]> {
    if (files.length === 0) return [];
    const ids = files as Array<ID<'File'>>;
    const [results, problems] = await Promise.all([
      this.db
        .select({ fileId: pnpExtractionResults.fileId })
        .from(pnpExtractionResults)
        // The file has to still be live — a soft-deleted File's row survives
        // (the cascade never fires, since the delete is soft), and without
        // this join a removed report's PnP result would keep resolving where
        // Neo4j's parent-required match returns nothing.
        .innerJoin(
          fileNodes,
          and(
            eq(fileNodes.id, pnpExtractionResults.fileId),
            isNull(fileNodes.deletedAt),
          ),
        )
        .where(inArray(pnpExtractionResults.fileId, ids)),
      this.db
        .select()
        .from(pnpExtractionResultProblems)
        .where(inArray(pnpExtractionResultProblems.fileId, ids)),
    ]);
    const haveResult = new Set(results.map((r) => r.fileId));
    const byFile = new Map<ID<'File'>, StoredProblem[]>();
    for (const p of problems) {
      const list = byFile.get(p.fileId) ?? [];
      list.push({
        id: p.id as StoredProblem['id'],
        type: p.type as StoredProblem['type'],
        source: p.source,
        context: p.context,
      });
      byFile.set(p.fileId, list);
    }
    return files.map((id) => {
      if (!haveResult.has(id)) {
        return { id, result: null };
      }
      const sorted = (byFile.get(id) ?? []).sort(
        (a, b) => severityIndex(a.type) - severityIndex(b.type),
      );
      // The resolver only reads `.problems` (via .values()), and the concrete
      // Planning/Progress type comes from the consuming field — so a plain
      // object carrying the problems is sufficient.
      const result = { problems: sorted } as unknown as PnpExtractionResult;
      return { id, result };
    });
  }

  // No live-query invalidation, deliberately: the Neo4j `save` is raw Cypher
  // that reaches none of CommonRepository's announcing helpers, so it is silent
  // too — matching it keeps this a pre-existing gap on every engine rather than
  // a cutover regression. In practice this runs during upload, right before the
  // file repo announces the new version anyway.
  async save(
    file: ID<'FileVersion'>,
    result: PnpExtractionResult,
  ): Promise<void> {
    const [version] = await this.db
      .select({ fileId: fileNodes.parentId })
      .from(fileNodes)
      .where(eq(fileNodes.id, file))
      .limit(1);
    const fileId = version?.fileId as ID<'File'> | undefined;
    if (!fileId) {
      return;
    }
    await this.db
      .insert(pnpExtractionResults)
      .values({ fileId })
      .onConflictDoNothing();
    // Replace the problem set wholesale (mirrors the Neo4j delete-then-create).
    await this.db
      .delete(pnpExtractionResultProblems)
      .where(eq(pnpExtractionResultProblems.fileId, fileId));
    const rows = [...result.problems.values()].map((p) => ({
      id: p.id,
      fileId,
      type: p.type,
      source: p.source,
      context: p.context,
    }));
    if (rows.length > 0) {
      await this.db.insert(pnpExtractionResultProblems).values(rows);
    }
  }
}
