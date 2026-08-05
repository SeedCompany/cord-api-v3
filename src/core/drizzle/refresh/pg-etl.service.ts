import { Inject, Injectable, Optional } from '@nestjs/common';
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
 * DI token for registering domain loaders. Concrete loaders are provided as
 * multi-providers (in DrizzleModule, or a module it imports):
 *
 *   { provide: PG_ETL_LOADERS, useClass: MyDomainLoader, multi: true }
 *
 * and PgEtlService receives all of them, in registration order, as an array.
 */
export const PG_ETL_LOADERS = Symbol('PG_ETL_LOADERS');

/**
 * Orchestrates the Neo4j → Postgres data load for `pg refresh`.
 *
 * The connect/session/teardown/logging plumbing lives here; the actual
 * per-domain conversion lives in the {@link DomainLoader}s injected via
 * {@link PG_ETL_LOADERS}.
 *
 * TODO(cutover): do NOT write loaders against this interface. The per-domain
 * conversion already exists and lands separately as the cutover ETL, which
 * additionally reports rows-read against rows-written per table — the only
 * signal that rows were dropped on the way through, which a single "rows
 * written" count cannot express. When it lands, {@link run} should hand off to
 * it and this loader registry should go away.
 *
 * Until something is registered, {@link ready} is false and the refresh command
 * refuses to run (dropping the data and reloading nothing is worse than not
 * running).
 */
@Injectable()
export class PgEtlService {
  @Logger('postgres:etl') private readonly logger: ILogger;

  constructor(
    private readonly drizzle: DrizzleService,
    @Optional()
    @Inject(PG_ETL_LOADERS)
    private readonly loaders: DomainLoader[] = [],
  ) {}

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
      // Read-only, and stated to the driver rather than only in a comment: the
      // source is production or a staged copy of it, and no loader has any
      // business writing to it. A default session is a WRITE session, which
      // would also send every read to the cluster leader instead of a follower.
      const session = driver.session({
        database: source.database,
        defaultAccessMode: neo4j.session.READ,
      });
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
