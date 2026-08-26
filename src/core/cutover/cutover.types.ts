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
  /**
   * Nodes found in Neo4j that never reached the mapper, keyed by node label.
   * Written by `readAllRowsViaRepo`, reported by the harness.
   *
   * Lives here rather than in {@link TableStat} because the loss happens while
   * reading, before the extractor knows which table the row would have filled —
   * which is also why these rows are invisible to per-table reconciliation and
   * have to be totalled separately.
   */
  readonly notHydrated: Map<string, number>;
  /**
   * Columns where the source had no value and the loader supplied one, keyed by
   * `table.column`. Written by `orDefault`, reported by the harness.
   *
   * This is not a loss — the row lands and reconciles ✓. It is the opposite
   * problem: a value that did not exist now does, and everything reading
   * Postgres sees a real answer where the old system returned a blank. That is
   * invisible to per-table counts, invisible to the read comparison unless it
   * happens to ask for the field, and it changes what reports say. It was found
   * from the outside, by a downstream warehouse diff, which is exactly the
   * situation this block exists to prevent repeating.
   */
  readonly defaulted: Map<string, DefaultFill>;
  /** Read/insert chunk size. */
  readonly batchSize: number;
  /**
   * When true, bypass the scrub gate that normally refuses a production-scale
   * Neo4j graph without a scrub marker. Set this for the real cutover, where
   * loading production data is the entire point. Leave it false (the default)
   * for ongoing QA refreshes, which should always run against scrubbed data.
   */
  readonly allowProductionSource?: boolean;
  /**
   * When true, load even though other sessions are connected to the target.
   * They lose their session at the truncate below, and whatever they write
   * during the load lands in a half-populated database and reads afterwards as
   * a reconciliation mismatch. Leave it false unless you know who is attached.
   */
  readonly allowOtherSessions?: boolean;
  readonly log: (msg: string) => void;
}

/** One column's default-fill tally — see {@link CutoverContext.defaulted}. */
export interface DefaultFill {
  /** Values the source did not have, so the loader supplied `fallback`. */
  filled: number;
  /** Values offered to `orDefault`/`keepBlank` at this site, filled or not. */
  seen: number;
  /** The substituted value, rendered for the report. */
  fallback: string;
  /**
   * What the loader did with the blank. `invented` means it supplied a value
   * the source never had; `blank` means the column now allows NULL and the
   * blank survived. Both are counted, because both are worth seeing — but only
   * the first is a decision anyone has to defend.
   */
  mode: 'invented' | 'blank';
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
