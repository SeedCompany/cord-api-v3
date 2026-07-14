import type { GraphQLSchema } from 'graphql';
import type { AsyncLocalStorage } from 'node:async_hooks';
import type { GqlContextType } from '~/common';
import type { Identity } from '~/core/authentication';
import type { DrizzleDb } from '~/core/drizzle/drizzle.service';

/**
 * Shared types for the shadow-diff harness (cutover-only tooling).
 * See README.md in this folder.
 */

/** The global roles replayed as personas, in a fixed order. */
export type PersonaRole =
  | 'Administrator'
  | 'ProjectManager'
  | 'Consultant'
  | 'Intern'
  | 'FieldPartner'
  | 'Marketing'
  | 'StaffMember';

/** Domains whose Postgres tables are sampled for by-id reads. */
export type SampledDomain =
  | 'users'
  | 'tools'
  | 'fundingAccounts'
  | 'locations'
  | 'fieldZones'
  | 'fieldRegions'
  | 'organizations'
  | 'partners'
  | 'projects'
  | 'partnerships';

/** One hand-enumerated corpus operation (see corpus.ts). */
export interface CorpusEntry {
  /** Unique, stable key — diff matches captures on it. */
  readonly key: string;
  /** GraphQL source. By-id documents take a single `$id: ID!` variable. */
  readonly document: string;
  readonly variables?: Readonly<Record<string, unknown>>;
  /**
   * When set, the entry expands to one operation per deterministically
   * sampled id of this domain, executed with `{ id }` variables.
   */
  readonly idsFrom?: SampledDomain;
}

/** GraphQL error stripped to a comparable shape (no stacks). */
export interface NormalizedError {
  readonly message: string;
  readonly code?: string;
  readonly path?: ReadonlyArray<string | number>;
}

/** One operation × persona execution result. Errors are data (§ README). */
export interface OperationResult {
  readonly op: string;
  readonly persona: PersonaRole;
  readonly data: unknown;
  readonly errors: readonly NormalizedError[];
}

export interface CaptureMeta {
  readonly engine: string;
  readonly capturedAt: string;
  /** role → user id — must match between the two captures being diffed. */
  readonly personas: Readonly<Partial<Record<PersonaRole, string>>>;
  readonly skippedPersonas: readonly PersonaRole[];
  /** domain → sampled ids — must match between the two captures. */
  readonly sampledIds: Readonly<Record<SampledDomain, readonly string[]>>;
}

export interface CaptureFile {
  readonly meta: CaptureMeta;
  readonly results: readonly OperationResult[];
}

/** Everything capture mode needs from the booted app. */
export interface CaptureRunContext {
  readonly schema: GraphQLSchema;
  readonly identity: Identity;
  /**
   * `GqlContextHostImpl.als` — in-process execution bypasses the Yoga
   * `onExecute` plugin that normally populates it, so capture wraps every
   * operation in `als.run(contextValue, ...)` itself.
   */
  readonly gqlContextAls: AsyncLocalStorage<GqlContextType>;
  /** Personas + id samples are resolved from Postgres in BOTH capture runs. */
  readonly db: DrizzleDb;
  readonly engine: string;
  readonly log: (msg: string) => void;
}

/** A single leaf difference between the two captures. */
export interface DiffEntry {
  readonly op: string;
  readonly persona: PersonaRole;
  /** e.g. `data.users.items[3].id` or `errors[0].message`. */
  readonly path: string;
  readonly neo4j: unknown;
  readonly postgres: unknown;
  /** Ref of the known-delta rule that suppressed this diff, if any. */
  readonly suppressedBy?: string;
}

/** Per (operation × persona) rollup for the summary table. */
export interface OpPersonaSummary {
  readonly op: string;
  readonly persona: PersonaRole;
  readonly diffs: number;
  readonly suppressed: number;
  /** True when any UNSUPPRESSED diff falls under the `errors` path. */
  readonly errorsMismatch: boolean;
}

export interface DiffReport {
  readonly meta: {
    readonly neo4j: CaptureMeta;
    readonly postgres: CaptureMeta;
    readonly diffedAt: string;
  };
  readonly summaries: readonly OpPersonaSummary[];
  readonly diffs: readonly DiffEntry[];
  readonly suppressed: readonly DiffEntry[];
  readonly totals: {
    readonly pairs: number;
    readonly identical: number;
    readonly withDiffs: number;
    readonly withSuppressedOnly: number;
    readonly diffCount: number;
    readonly suppressedCount: number;
    /**
     * Values that differed only in datetime string form while representing
     * the same instant — treated as equal, but counted for transparency.
     */
    readonly instantNormalized: number;
  };
}
