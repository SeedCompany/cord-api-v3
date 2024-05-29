import { Injectable } from '@nestjs/common';
import { entries, mapKeys } from '@seedcompany/common';
import { Connection, node, Query, relation } from 'cypher-query-builder';
import { LazyGetter } from 'lazy-get-decorator';
import { pickBy, startCase } from 'lodash';
import { Duration } from 'luxon';
import { defer, firstValueFrom, shareReplay, takeUntil } from 'rxjs';
import {
  DuplicateException,
  ID,
  isIdLike,
  isSecured,
  MaybeUnsecuredInstance,
  ResourceShape,
  ServerException,
  UnwrapSecured,
} from '~/common';
import { AbortError, retry, RetryOptions } from '~/common/retry';
import { ConfigService } from '../config/config.service';
import { ILogger, Logger } from '../logger';
import { ShutdownHook } from '../shutdown.hook';
import { DbChanges } from './changes';
import {
  createBetterError,
  ServiceUnavailableError,
  UniquenessError,
} from './errors';
import {
  ACTIVE,
  deleteBaseNode,
  exp,
  updateProperty,
  UpdatePropertyOptions,
  variable,
} from './query';

export interface ServerInfo {
  version: [major: number, minor: number, patch: number];
  /** Major.Minor float number */
  versionXY: number;
  edition: string;
  databases: DbInfo[];
}

interface DbInfo {
  name: string;
  status: string;
  error?: string;
}

type PermanentAfterOption = Pick<
  UpdatePropertyOptions<any, any, any>,
  'permanentAfter'
>;

@Injectable()
export class DatabaseService {
  private attemptedDbCreation = false;

  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
    private readonly shutdown$: ShutdownHook,
    @Logger('database:service') private readonly logger: ILogger,
  ) {}

  get conn() {
    return this.db;
  }

  /**
   * This will run the function after connecting to the database.
   * If connection to database fails while executing function it will keep
   * retrying (after another successful connection) until the function finishes.
   */
  async runOnceUntilCompleteAfterConnecting(
    run: (info: ServerInfo) => Promise<void>,
  ) {
    await this.waitForConnection(
      {
        forever: true,
        minTimeout: { seconds: 10 },
        maxTimeout: { minutes: 5 },
      },
      run,
    );
  }

  /**
   * Wait for database connection.
   * Optionally run a function in retry context after connecting.
   */
  async waitForConnection(
    options?: RetryOptions,
    then?: (info: ServerInfo) => Promise<void>,
  ) {
    await retry(async () => {
      try {
        const info = await this.getServerInfo();
        await this.createDbIfNeeded(info);
        await then?.(info);
      } catch (e) {
        throw e instanceof ServiceUnavailableError ? e : new AbortError(e);
      }
    }, options);
  }

  /**
   * Start a query. It can be executed with run() or first();
   *
   * @example
   * query().matchNode('n').return('n').run();
   *
   * @example
   * query('match (n) return n').run();
   */
  query<Result = unknown>(
    query?: string,
    parameters?: Record<string, any>,
  ): Query<Result> {
    const q = this.db.query() as Query<Result>;
    if (query) {
      q.raw(query, parameters);
    }
    return q;
  }

  async getServerInfo() {
    return await firstValueFrom(this.serverInfo$);
  }
  @LazyGetter() private get serverInfo$() {
    return defer(() => this.queryServerInfo()).pipe(
      takeUntil(this.shutdown$),
      shareReplay({
        refCount: false,
        bufferSize: 1,
        windowTime: Duration.from('3 mins').toMillis(),
      }),
    );
  }
  private async queryServerInfo(): Promise<ServerInfo> {
    // @ts-expect-error Yes this is private, but we have a special use case.
    // We need to run this query with a session that's not configured to use the
    // database that may not exist.
    const session = this.db.driver.session();
    try {
      const generalInfo = await session.executeRead((tx) =>
        tx.run(`
          call dbms.components()
          yield versions, edition
          unwind versions as version
          return version, edition
        `),
      );
      const info = generalInfo.records[0];
      if (!info) {
        throw new ServerException('Unable to determine server info');
      }
      // "Administration" command doesn't work with read transactions
      const dbs = await session.executeWrite((tx) =>
        tx.run('show databases yield *'),
      );
      const version = (info.get('version') as string).split('.').map(Number);
      return {
        version: version as ServerInfo['version'],
        versionXY: version[0] + version[1] / 10,
        edition: info.get('edition'),
        databases: dbs.records.map((r) => ({
          name: r.get('name'),
          status: r.get('currentStatus'),
          error:
            r.get(version[0] >= 5 ? 'statusMessage' : 'error') || undefined,
        })),
      };
    } catch (e) {
      throw createBetterError(e);
    } finally {
      await session.close();
    }
  }

  private async createDbIfNeeded(info: ServerInfo) {
    if (this.attemptedDbCreation) {
      return;
    }
    this.attemptedDbCreation = true;

    const dbName = this.config.neo4j.database;
    if (!dbName || info.databases.some((db) => db.name === dbName)) {
      return; // already exists or assuming default exists
    }
    await this.runAdminCommand('CREATE', dbName, info);
  }

  async dropDb() {
    const dbName = this.config.neo4j.database;
    if (!dbName) {
      return; // don't drop the default db
    }
    await this.runAdminCommand('DROP', dbName, await this.getServerInfo());
  }

  private async runAdminCommand(
    action: 'CREATE' | 'DROP',
    dbName: string,
    _info: ServerInfo,
  ) {
    // @ts-expect-error Yes this is private, but we have a special use case.
    // We need to run this query with a session that's not configured to use the
    // database we are trying to create.
    const session = this.db.driver.session();
    try {
      await session.executeWrite((tx) =>
        tx.run(
          [
            `${action} DATABASE $name`,
            action === 'CREATE' ? 'IF NOT EXISTS' : 'IF EXISTS',
            'WAIT',
          ].join(' '),
          {
            name: dbName,
          },
        ),
      );
    } finally {
      await session.close();
    }
  }

  async createFullTextIndex(
    name: string,
    labels: string[],
    properties: string[],
    config: { analyzer?: string; eventuallyConsistent?: boolean },
  ) {
    const quote = (q: string) => `'${q}'`;
    const parsedConfig = {
      analyzer: config.analyzer ? quote(config.analyzer) : undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      eventually_consistent: config.eventuallyConsistent
        ? exp(config.eventuallyConsistent)
        : undefined,
    };

    const options =
      entries(pickBy(parsedConfig, (v) => v !== undefined)).length > 0
        ? {
            indexConfig: mapKeys(parsedConfig, (k) => `fulltext.${k}`).asRecord,
          }
        : undefined;
    await this.query(
      `
        CREATE FULLTEXT INDEX ${name} IF NOT EXISTS
        FOR (n:${labels.join('|')})
        ON EACH ${exp(properties.map((p) => `n.${p}`))}
        ${options ? `OPTIONS ${exp(options)}` : ''}
      `,
    ).run();
  }

  async updateProperties<
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
  >({
    type,
    object,
    changes,
    changeset,
    permanentAfter,
  }: {
    // This becomes the label of the base node
    type: TResourceStatic;
    // The current object to get the ID from & the starting point for the return value
    object: TObject;
    // The changes
    changes: DbChanges<TResourceStatic['prototype']>;
    // Changeset ID
    changeset?: ID;
  } & PermanentAfterOption): Promise<TObject> {
    let updated = object;
    for (const [prop, change] of entries(changes)) {
      if (change === undefined) {
        continue;
      }
      await this.updateProperty({
        type,
        object,
        key: prop as any,
        value: change as any,
        changeset,
        permanentAfter,
      });

      updated = {
        ...updated,
        [prop]: isSecured(object[prop as any])
          ? // replace value in secured object keeping can* properties
            {
              ...object[prop],
              value: change,
            }
          : // replace value directly
            change,
      };
    }

    return updated;
  }

  async updateProperty<
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string,
  >({
    type,
    object: { id },
    key,
    value,
    changeset,
    permanentAfter,
  }: {
    type: TResourceStatic;
    object: TObject;
    key: Key;
    value: UnwrapSecured<TObject[Key]>;
    changeset?: ID;
  } & PermanentAfterOption): Promise<void> {
    const label = type.name;

    // check if the node is created in changeset, update property normally
    if (changeset) {
      const result = await this.db
        .query()
        .match([
          node('changeset', 'Changeset', { id: changeset }),
          relation('out', '', 'changeset', ACTIVE),
          node('node', label, { id }),
        ])
        .return('node.id')
        .first();

      if (result) {
        changeset = undefined;
      }
    }

    const update = this.db
      .query()
      .match(node('node', label, { id }))
      .apply(
        changeset
          ? (q) => q.match(node('changeset', 'Changeset', { id: changeset }))
          : null,
      )
      .apply(
        updateProperty<TResourceStatic, TObject, Key>({
          resource: type,
          key,
          value,
          changeset: changeset ? variable('changeset') : undefined,
          permanentAfter,
        }),
      )
      .return('*');

    let result;
    try {
      result = await update.first();
    } catch (e) {
      if (e instanceof UniquenessError) {
        throw new DuplicateException(
          // Guess the input field path based on name convention
          `${startCase(label).split(' ').at(-1)!.toLowerCase()}.${key}`,
          `${startCase(label)} with this ${key} is already in use`,
          e,
        );
      }
      throw new ServerException(`Failed to update property ${label}.${key}`, e);
    }

    if (
      !result ||
      (result.stats.created === 0 && result.stats.deactivated === 0) ||
      result.stats.updated === 0
    ) {
      throw new ServerException(`Could not find ${label}.${key} to update`);
    }
  }

  async deleteNode(objectOrId: { id: ID } | ID) {
    const id = isIdLike(objectOrId) ? objectOrId : objectOrId.id;
    const query = this.db
      .query()
      .matchNode('baseNode', { id })
      .apply(deleteBaseNode('baseNode'))
      .return('*');
    await query.run();
  }
}
