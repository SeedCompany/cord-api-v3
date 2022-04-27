import { Injectable } from '@nestjs/common';
import { oneLine } from 'common-tags';
import { Connection, node, Query, relation } from 'cypher-query-builder';
import { compact, isEmpty, last, mapKeys, pickBy, startCase } from 'lodash';
import {
  entries,
  ID,
  InputException,
  isIdLike,
  isSecured,
  MaybeUnsecuredInstance,
  ResourceShape,
  ServerException,
  Session,
  UnwrapSecured,
} from '../../common';
import {
  ConfigService,
  ILogger,
  Logger,
  ServiceUnavailableError,
  UniquenessError,
} from '..';
import { AbortError, retry, RetryOptions } from '../../common/retry';
import { DbChanges } from './changes';
import { ACTIVE, deleteBaseNode, exp, updateProperty } from './query';

export interface ServerInfo {
  version: string;
  edition: string;
  databases: DbInfo[];
}

interface DbInfo {
  name: string;
  status: string;
  error?: string;
}

@Injectable()
export class DatabaseService {
  private attemptedDbCreation = false;

  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
    @Logger('database:service') private readonly logger: ILogger
  ) {}

  /**
   * This will run the function after connecting to the database.
   * If connection to database fails while executing function it will keep
   * retrying (after another successful connection) until the function finishes.
   */
  async runOnceUntilCompleteAfterConnecting(
    run: (info: ServerInfo) => Promise<void>
  ) {
    await this.waitForConnection(
      {
        forever: true,
        minTimeout: { seconds: 10 },
        maxTimeout: { minutes: 5 },
      },
      run
    );
  }

  /**
   * Wait for database connection.
   * Optionally run a function in retry context after connecting.
   */
  async waitForConnection(
    options?: RetryOptions,
    then?: (info: ServerInfo) => Promise<void>
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
    parameters?: Record<string, any>
  ): Query<Result> {
    const q = this.db.query() as Query<Result>;
    if (query) {
      q.raw(query, parameters);
    }
    return q;
  }

  async getServerInfo(): Promise<ServerInfo> {
    // @ts-expect-error Yes this is private, but we have a special use case.
    // We need to run this query with a session that's not configured to use the
    // database that may not exist.
    const session = this.db.driver.session();
    try {
      const generalInfo = await session.readTransaction((tx) =>
        tx.run(`
          call dbms.components()
          yield versions, edition
          unwind versions as version
          return version, edition
        `)
      );
      const info = generalInfo.records[0];
      if (!info) {
        throw new ServerException('Unable to determine server info');
      }
      // "Administration" command doesn't work with read transactions
      const dbs = await session.writeTransaction((tx) =>
        tx.run(`
          show databases
          yield name, currentStatus, error
        `)
      );
      return {
        version: info.get('version'),
        edition: info.get('edition'),
        databases: dbs.records.map((r) => ({
          name: r.get('name'),
          status: r.get('currentStatus'),
          error: r.get('error') || undefined,
        })),
      };
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
    info: ServerInfo
  ) {
    // @ts-expect-error Yes this is private, but we have a special use case.
    // We need to run this query with a session that's not configured to use the
    // database we are trying to create.
    const session = this.db.driver.session();
    const supportsWait = parseFloat(info.version.slice(0, 3)) >= 4.2;
    try {
      await session.writeTransaction((tx) =>
        tx.run(
          compact([
            `${action} DATABASE $name`,
            action === 'CREATE' ? 'IF NOT EXISTS' : 'IF EXISTS',
            supportsWait ? 'WAIT' : '',
          ]).join(' '),
          {
            name: dbName,
          }
        )
      );
    } finally {
      await session.close();
    }
  }

  async createFullTextIndex(
    name: string,
    labels: string[],
    properties: string[],
    config: { analyzer?: string; eventuallyConsistent?: boolean }
  ) {
    const quote = (q: string) => `'${q}'`;
    const parsedConfig = {
      analyzer: config.analyzer ? quote(config.analyzer) : undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      eventually_consistent: config.eventuallyConsistent
        ? exp(config.eventuallyConsistent)
        : undefined,
    };

    const info = await this.getServerInfo();
    if (info.version.startsWith('4.3')) {
      const options = !isEmpty(pickBy(parsedConfig, (v) => v !== undefined))
        ? {
            indexConfig: mapKeys(parsedConfig, (_, k) => `fulltext.${k}`),
          }
        : undefined;
      await this.query(
        `
          CREATE FULLTEXT INDEX ${name} IF NOT EXISTS
          FOR (n:${labels.join('|')})
          ON EACH ${exp(properties.map((p) => `n.${p}`))}
          ${options ? `OPTIONS ${exp(options)}` : ''}
        `
      ).run();
      return;
    }

    const exists = await this.query(
      `call db.indexes() yield name where name = '${name}' return name limit 1`
    ).first();
    if (exists) {
      return;
    }
    await this.query(
      oneLine`
        CALL db.index.fulltext.createNodeIndex(
          ${quote(name)},
          ${exp(labels.map(quote))},
          ${exp(properties.map(quote))},
          ${exp(parsedConfig)}
        )
      `
    ).run();
  }

  async updateProperties<
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    }
  >({
    type,
    object,
    changes,
    changeset,
  }: {
    // This becomes the label of the base node
    type: TResourceStatic;
    // The current object to get the ID from & the starting point for the return value
    object: TObject;
    // The changes
    changes: DbChanges<TResourceStatic['prototype']>;
    // Changeset ID
    changeset?: ID;
  }): Promise<TObject> {
    let updated = object;
    for (const [prop, change] of entries(changes)) {
      if (change === undefined) {
        continue;
      }
      await this.updateProperty({
        type,
        object,
        key: prop as any,
        value: change,
        changeset,
      });

      updated = {
        ...updated,
        [prop]: isSecured(object[prop])
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
    Key extends keyof DbChanges<TObject> & string
  >({
    type,
    object: { id },
    key,
    value,
    changeset,
  }: {
    type: TResourceStatic;
    object: TObject;
    key: Key;
    value: UnwrapSecured<TObject[Key]>;
    changeset?: ID;
  }): Promise<void> {
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
        updateProperty<TResourceStatic, TObject, Key>({
          resource: type,
          key,
          value,
          changeset,
        })
      )
      .return<{ numPropsCreated: number; numPropsDeactivated: number }>(
        'numPropsCreated, numPropsDeactivated'
      );

    let result;
    try {
      result = await update.first();
    } catch (e) {
      if (e instanceof UniquenessError) {
        throw new InputException(
          `${startCase(label)} with this ${key} is already in use`,
          // Guess the input field path based on name convention
          `${last(startCase(label).split(' '))!.toLowerCase()}.${key}`,
          e
        );
      }
      throw new ServerException(`Failed to update property ${label}.${key}`, e);
    }

    if (
      !result ||
      (result.numPropsCreated === 0 && result.numPropsDeactivated === 0)
    ) {
      throw new ServerException(`Could not find ${label}.${key} to update`);
    }
  }

  // eslint-disable-next-line @seedcompany/no-unused-vars
  async checkDeletePermission(id: ID, session: Partial<Session> | string) {
    return true;
    // const query = this.db
    //   .query()
    //   .apply(matchRequestingUser(session))
    //   .match(node('node', { id }))
    //   .match([
    //     node('requestingUser'),
    //     relation('in', 'memberOfSecurityGroup', 'member'),
    //     node('securityGroup', 'SecurityGroup'),
    //     relation('out', 'sgPerms', 'permission'),
    //     node('perm', 'Permission', { read: true, property: 'canDelete' }),
    //     relation('out', 'permsOfBaseNode', 'baseNode'),
    //     node('node'),
    //   ])
    //   .return('perm');

    // const result = await query.first();
    // return !!result;
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
