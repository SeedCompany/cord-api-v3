import { type ModuleRef } from '@nestjs/core';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import { type DatabaseService } from '~/core/neo4j';

/**
 * Shared context handed to every {@link Extractor}. Holds both live DB handles
 * (Neo4j = source, Drizzle/Postgres = target) plus run options.
 *
 * The harness boots with `DATABASE=neo4j` (so `splitDb` resolves the *Neo4j*
 * repositories, which are the proven readers) AND `POSTGRES_URL` set (so
 * `DrizzleService` connects to the *target* regardless of engine). See
 * cutover.run.ts + README.md.
 */
export interface CutoverContext {
  /** Source: raw Cypher (`.query(...).run()`) for id enumeration + junctions. */
  readonly neo4j: DatabaseService;
  /** Target: raw Drizzle insert (`db.insert(table).values(...)`). */
  readonly db: DrizzleDb;
  /** Resolves the canonical (Neo4j) domain repositories for hydration. */
  readonly moduleRef: ModuleRef;
  /** When true: read + map (to surface errors) but do NOT write or truncate. */
  readonly dryRun: boolean;
  /** Read/insert chunk size. */
  readonly batchSize: number;
  readonly log: (msg: string) => void;
}

export interface TableStat {
  /** Rows read (and mapped) from Neo4j. */
  read: number;
  /** Rows inserted into Postgres (0 in dry-run). */
  inserted: number;
}

/**
 * One domain's ETL. Reads its entities out of Neo4j, maps them to the Drizzle
 * row shape, and inserts them — ID-preserving, no service/hook side-effects.
 *
 * Extractors are pure data movers: no business validation, no security. The
 * harness orders them by {@link dependsOn}, truncates {@link targetTables}
 * up front (unless dry-run), then runs each and reconciles row counts.
 */
export interface Extractor {
  /** Unique domain name (used for ordering + `--only`). */
  readonly name: string;
  /**
   * Postgres tables this extractor fills, in insert (dependency) order. Used
   * by the harness for truncate + row-count reconciliation.
   */
  readonly targetTables: readonly string[];
  /** Names of extractors that must run before this one (FK dependencies). */
  readonly dependsOn?: readonly string[];
  /** Returns per-table {read, inserted} stats. */
  run: (ctx: CutoverContext) => Promise<Record<string, TableStat>>;
}
