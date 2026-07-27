import { Injectable } from '@nestjs/common';
import neo4j, { type Session } from 'neo4j-driver';
import { ILogger, Logger } from '~/core/logger';
import { type DrizzleDb, DrizzleService } from '../drizzle.service';

/** Where a loader reads from (Neo4j) and writes to (Postgres/Drizzle). */
export interface EtlContext {
  /** Source Neo4j session — READ ONLY. */
  readonly neo4j: Session;
  /** Target Postgres via Drizzle. */
  readonly db: DrizzleDb;
  readonly logger: ILogger;
}

/**
 * Converts one domain from the graph model to the relational model.
 *
 * This is the greenfield part of the cutover: each loader reads its domain's
 * nodes/relationships from Neo4j and writes the equivalent rows into Postgres
 * via Drizzle, returning the number of rows written. Order matters — a loader
 * whose rows are referenced by FKs must run before its dependents (mirror the
 * dependency order already encoded by `splitDb()` and the schema).
 */
export interface DomainLoader {
  readonly name: string;
  load: (ctx: EtlContext) => Promise<number>;
}

export interface EtlSource {
  url: string;
  username: string;
  password: string;
  database?: string;
}

/**
 * Orchestrates the Neo4j → Postgres data load for `pg refresh`.
 *
 * The connect/session/teardown/logging plumbing lives here; the actual
 * per-domain conversion lives in the {@link DomainLoader}s registered below.
 */
@Injectable()
export class PgEtlService {
  @Logger('postgres:etl') private readonly logger: ILogger;

  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Registered domain loaders, run in array order.
   *
   * TODO(cutover): implement a `DomainLoader` per ported domain and add it
   * here (or refactor to discover them from the feature modules, like the
   * command discovery does). While this list is empty, {@link ready} is false
   * and the refresh command refuses to run — a refresh that dropped the data
   * and reloaded nothing would be worse than not running at all.
   */
  private readonly loaders: DomainLoader[] = [];

  /**
   * Whether any domain loaders are registered. When false a refresh would wipe
   * the database and load nothing, so callers must refuse before dropping.
   */
  get ready(): boolean {
    return this.loaders.length > 0;
  }

  async run(source: EtlSource): Promise<void> {
    if (!this.ready) {
      // Defensive: callers gate on `ready` before dropping the schema.
      throw new Error('No ETL domain loaders registered');
    }

    this.logger.info('Starting Neo4j → Postgres load', {
      source: source.url,
      loaders: this.loaders.length,
    });

    const driver = neo4j.driver(
      source.url,
      neo4j.auth.basic(source.username, source.password),
    );
    try {
      const session = driver.session({ database: source.database });
      try {
        const ctx: EtlContext = {
          neo4j: session,
          db: this.drizzle.client,
          logger: this.logger,
        };
        for (const loader of this.loaders) {
          const rows = await loader.load(ctx);
          this.logger.info(`Loaded ${loader.name}`, { rows });
        }
      } finally {
        await session.close();
      }
    } finally {
      await driver.close();
    }

    this.logger.info('Neo4j → Postgres load complete');
  }
}
