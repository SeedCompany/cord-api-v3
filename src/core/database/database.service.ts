import { Injectable } from '@nestjs/common';
import {
  Connection,
  equals,
  node,
  Query,
  regexp,
  relation,
} from 'cypher-query-builder';
import type { Pattern } from 'cypher-query-builder/dist/typings/clauses/pattern';
import { cloneDeep, last, Many, startCase, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { Driver, Session as Neo4jSession } from 'neo4j-driver';
import { assert } from 'ts-essentials';
import {
  entries,
  getDbPropertyLabels,
  ID,
  InputException,
  isIdLike,
  isSecured,
  many,
  MaybeUnsecuredInstance,
  Order,
  Resource,
  ResourceShape,
  ServerException,
  Session,
  UnwrapSecured,
} from '../../common';
import { ILogger, Logger, ServiceUnavailableError, UniquenessError } from '..';
import { AbortError, retry, RetryOptions } from '../../common/retry';
import { ConfigService } from '../config/config.service';
import { DbChanges, getChanges } from './changes';
import { deleteBaseNode } from './query';
import { determineSortValue } from './query.helpers';
import { hasMore } from './results';
import { Transactional } from './transactional.decorator';

export const property = (
  prop: string,
  value: any | null,
  baseNode: string,
  propVar = prop,
  extraPropLabel?: Many<string>
) => [
  [
    node(baseNode),
    relation('out', '', prop, {
      active: true,
      createdAt: DateTime.local(),
    }),
    node(propVar, ['Property', ...many(extraPropLabel ?? [])], {
      value,
    }),
  ],
];

export const matchSession = (
  session: Session,
  {
    // eslint-disable-next-line @seedcompany/no-unused-vars
    withAclEdit,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    withAclRead,
    requestingUserConditions = {},
  }: {
    withAclEdit?: string;
    withAclRead?: string;
    requestingUserConditions?: Record<string, any>;
  } = {}
) => [
  node('token', 'Token', {
    active: true,
    value: session.token,
  }),
  relation('in', '', 'token', {
    active: true,
  }),
  node('requestingUser', 'User', {
    id: session.userId,
    ...requestingUserConditions,
  }),
];

export interface ServerInfo {
  name: string;
  version: string;
  edition: string;
}

@Injectable()
export class DatabaseService {
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
  async runOnceUntilCompleteAfterConnecting(run: () => Promise<void>) {
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
  async waitForConnection(options?: RetryOptions, then?: () => Promise<void>) {
    await retry(async () => {
      try {
        await this.getServerInfo();
        await then?.();
      } catch (e) {
        throw e instanceof ServiceUnavailableError ? e : new AbortError(e);
      }
    }, options);
  }

  /**
   * USE THIS AT YOUR OWN RISK, and expect to have a harder time.
   * Save yourself the trouble and just use this instead:
   * ```
   * query('...').run/first();
   * ```
   *
   * Retrieve a raw session from the driver.
   *
   * Note that when you use this method you need:
   * - To pass in the database name from the config service.
   * - To explicitly close the session in a finally clause
   * - Manually convert query parameters to db compatible values
   *   - Such as Luxon DateTime to Neo4j's ZonedDateTime
   * - Manually convert the output from
   *   - Neo4j's Number class to JS numbers
   *   - Neo4j's ZonedDateTime class to Luxon DateTime
   *   - etc.
   *   - Also understand the result output. Instead of
   *   ```
   *   const result = await query('... return foo.id as id').first();
   *   const id = result?.id;
   *   ```
   *   You'll need to do
   *   ```
   *   const result = await session.run('...');
   *   const id = result.records.[0]?.get('id');
   *   ```
   * - Expect that @Transactional decorators will not work and the current
   *   transaction will be ignored.
   * - Error handling relying on error classes will not work.
   *   i.e. instead of
   *   ```
   *   if (e instanceof UniquenessError && e.label === 'EmailAddress') {}
   *   ```
   *   you'll need to do
   *   ```
   *   if (
   *     e instanceof Neo4jError &&
   *     e.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' &&
   *     e.message.includes('already exists with label') &&
   *     regexThatImNotGoingToWriteOutHere.exec(e.message)?[0] === 'EmailAddress'
   *   ) {}
   *   ```
   *   This is just one example. Expect more things to break with the app.
   *
   */
  session(...args: Parameters<Driver['session']>): Neo4jSession {
    // @ts-expect-error it exists it's just private
    return this.db.driver.session(...args);
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
  query(query?: string, parameters?: Record<string, any>): Query {
    const q = this.db.query();
    if (query) {
      q.raw(query, parameters);
    }
    return q;
  }

  @Transactional()
  async getServerInfo() {
    const info = await this.db
      .query()
      .raw(
        `call dbms.components()
         yield name, versions, edition
         unwind versions as version
         return name, version, edition`
      )
      .asResult<ServerInfo>()
      .first();
    if (!info) {
      throw new ServerException('Unable to determine server info');
    }
    return info;
  }

  getActualChanges = getChanges;

  async updateProperties<
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    }
  >({
    type,
    object,
    changes,
  }: {
    // This becomes the label of the base node
    type: TResourceStatic;
    // The current object to get the ID from & the starting point for the return value
    object: TObject;
    // The changes
    changes: DbChanges<TResourceStatic['prototype']>;
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
  }: {
    type: TResourceStatic;
    object: TObject;
    key: Key;
    value?: UnwrapSecured<TObject[Key]>;
  }): Promise<void> {
    const label = type.name;

    const propLabels = getDbPropertyLabels(type, key);

    const createdAt = DateTime.local();
    const newPropertyNodeProps = {
      createdAt,
      value,
      sortValue: determineSortValue(value),
    };
    const update = this.db
      .query()
      .match(node('node', label, { id }))
      .match([
        node('node'),
        relation('out', 'oldToProp', key, { active: true }),
        node('oldPropVar', 'Property'),
      ])
      .setValues({
        'oldToProp.active': false,
      })
      .raw(
        `
        with node, oldPropVar, reduce(deletedLabels = [], label in labels(oldPropVar) | deletedLabels + ("Deleted_" + label)) as deletedLabels
        call apoc.create.removeLabels(oldPropVar, labels(oldPropVar)) yield node as nodeRemoved
        with node, oldPropVar, deletedLabels
        call apoc.create.addLabels(oldPropVar, deletedLabels) yield node as nodeAdded
        `
      )
      .with('*')
      .limit(1)
      .create([
        node('node'),
        relation('out', 'toProp', key, {
          active: true,
          createdAt,
        }),
        node('newPropNode', propLabels, newPropertyNodeProps),
      ])
      .return('newPropNode');

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

    if (!result) {
      throw new ServerException(`Could not find ${label}.${key} to update`);
    }
  }

  async list<TObject extends Resource>({
    session,
    props,
    nodevar,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    owningOrgId,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    skipOwningOrgCheck,
    aclReadProp,
    aclEditProp,
    input,
  }: {
    session: Session;
    props: ReadonlyArray<
      keyof TObject | { secure: boolean; name: keyof TObject; list?: boolean }
    >;
    nodevar: string;
    owningOrgId?: ID;
    skipOwningOrgCheck?: boolean;
    aclReadProp?: string;
    aclEditProp?: string;
    input: {
      page: number;
      count: number;
      sort: string;
      order: Order;
      filter: Record<string, any>;
    };
  }): Promise<{ hasMore: boolean; total: number; items: TObject[] }> {
    const nodeName = upperFirst(nodevar);
    const aclReadPropName = aclReadProp || `canRead${nodeName}`;
    const aclEditPropName = aclEditProp || `canEdit${nodeName}`;
    const idFilter = input.filter.id ? { id: input.filter.id } : {};
    const userIdFilter = input.filter.userId ? { id: input.filter.userId } : {};

    const query = this.db.query().match([
      matchSession(session, {
        withAclRead: aclReadPropName,
      }),
    ]);

    if (Object.keys(userIdFilter).length) {
      query.match([
        [
          node('user', 'User', {
            ...userIdFilter,
          }),
          relation('out', '', nodevar, {
            active: true,
          }),
          node('n', nodeName, {
            ...idFilter,
          }),
        ],
      ]);
    } else {
      query.match([
        node('n', nodeName, {
          ...idFilter,
        }),
      ]);
    }
    query.with('count(n) as total, requestingUser, n');

    for (const prop of props) {
      const propName = typeof prop === 'object' ? prop.name : prop;

      query.optionalMatch([
        node('n', nodeName),
        relation('out', '', propName as string, { active: true }),
        node(propName as string, 'Property'),
      ]);
    }

    query.with([
      // with the ACL fields
      'requestingUser',

      // always with <node>
      'n',

      // with the rest of the requested properties
      ...props.map((prop) => {
        const propName = (
          typeof prop === 'object' ? prop.name : prop
        ) as string;
        return propName;
      }),
    ]);

    if (input.filter && Object.keys(input.filter).length) {
      const where: Record<string, any> = {};
      for (const [k, val] of Object.entries(input.filter)) {
        if (k !== 'id' && k !== 'userId' && k !== 'mine') {
          assert(
            typeof val === 'string',
            `Filter "${k}" must have a string value`
          );
          if (!Array.isArray(val)) {
            where[k + '.value'] = regexp(`.*${val}.*`, true);
          } else {
            where[k + '.value'] = equals(val);
          }
        }
      }
      if (Object.keys(where).length) {
        query.where(where);
      }
    }

    // Clone the query here, before we apply limit/offsets, so that we can get an accurate aggregate of the total filtered result set
    const countQuery = cloneDeep(query);
    countQuery.return('count(n) as total');

    query
      .returnDistinct([
        // return the ACL fields
        {
          requestingUser: [
            { [aclReadPropName]: aclReadPropName },
            { [aclEditPropName]: aclEditPropName },
          ],
        },

        // always return the <node>.id and <node>.createdAt field
        {
          n: [{ id: 'id' }, { createdAt: 'createdAt' }],
        },

        // return the rest of the requested properties
        ...props.map((prop) => {
          const propName = (
            typeof prop === 'object' ? prop.name : prop
          ) as string;
          return { [propName + '.value']: propName };
        }),
      ])
      .orderBy([input.sort], input.order)
      .skip((input.page - 1) * input.count)
      .limit(input.count);

    const result = await query.run();
    const countResult = await countQuery.run();

    const total = countResult[0]?.total || 0;

    const items = result.map<TObject>((row) => {
      const item: any = {
        id: row.id,
        createdAt: row.createdAt,
      };

      for (const prop of props) {
        const propName = (
          typeof prop === 'object' ? prop.name : prop
        ) as string;
        const secure = typeof prop === 'object' ? prop.secure : true;
        const list = typeof prop === 'object' ? prop.list : false;

        if (list) {
          const value = row[propName] ?? [];

          if (secure) {
            item[propName] = {
              value,
              canRead: Boolean(row[aclReadPropName]) || false,
              canEdit: Boolean(row[aclEditPropName]) || false,
            };
          } else {
            item[propName] = value;
          }
        } else if (secure) {
          item[propName] = {
            value: row[propName],
            canRead: Boolean(row[aclReadPropName]) || false,
            canEdit: Boolean(row[aclEditPropName]) || false,
          };
        } else {
          item[propName] = row[propName];
        }
      }

      return item;
    });

    return {
      hasMore: hasMore(input, total),
      total,
      items,
    };
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
      .apply(deleteBaseNode)
      .return('*');
    await query.run();
  }

  async hasProperties({
    session,
    id,
    props,
    nodevar,
  }: {
    id: ID;
    session: Session;
    props: string[];
    nodevar: string;
  }): Promise<boolean> {
    const resultingArr = [];
    for (const prop of props) {
      const hasProp = await this.hasProperty({
        session,
        id,
        prop,
        nodevar,
      });
      resultingArr.push(hasProp);
    }
    return resultingArr.every((n) => n);
  }

  async hasProperty({
    id,
    session,
    prop,
    nodevar,
  }: {
    id: ID;
    session: Session;
    prop: string;
    nodevar: string;
  }): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node(nodevar, upperFirst(nodevar), {
            id,
            active: true,
          }),
          relation('out', 'rel', prop, { active: true }),
          node(prop, 'Property', { active: true }),
        ],
      ])
      .return('count(rel) as total')
      .first();

    const totalNumber = result?.total || 0;
    const hasPropertyNode = totalNumber > 0;
    return hasPropertyNode;
  }

  async isRelationshipUnique({
    session,
    id,
    relName,
    srcNodeLabel,
  }: {
    session: Session;
    id: ID;
    relName: string;
    srcNodeLabel: string;
  }): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('n', srcNodeLabel, {
            id,
            active: true,
          }),
          relation('out', 'rel', relName, { active: true }),
          node('', { active: true }),
        ],
      ])
      .return('count(rel) as total')
      .first();

    const totalNumber = result?.total || 0;
    const isUnique = totalNumber <= 1;

    return isUnique;
  }

  async isUniqueProperties({
    session,
    id,
    props,
    nodevar,
  }: {
    id: ID;
    session: Session;
    props: string[];
    nodevar: string;
  }): Promise<boolean> {
    const resultingArr = [];
    for (const prop of props) {
      const isUnique = await this.isUniqueProperty({
        session,
        id,
        prop,
        nodevar,
      });
      resultingArr.push(isUnique);
    }
    return resultingArr.every((n) => n);
  }

  async isUniqueProperty({
    id,
    session,
    prop,
    nodevar,
  }: {
    id: ID;
    session: Session;
    prop: string;
    nodevar: string;
  }): Promise<boolean> {
    const query = this.db
      .query()
      .match([
        matchSession(session),
        [
          node(nodevar, upperFirst(nodevar), {
            id,
            active: true,
          }),
          relation('out', 'rel', prop, { active: true }),
          node(prop, 'Property', { active: true }),
        ],
      ])
      .return('count(rel) as total');

    const result = await query.first();
    const totalNumber = result?.total || 0;

    const isUniqueProperty = totalNumber <= 1;
    return isUniqueProperty;
  }

  async addLabelsToPropNodes(
    baseNodeId: ID,
    property: string,
    lables: string[]
  ): Promise<void> {
    const addLabel = this.db
      .query()
      .match([node('baseNode', { active: true, id: baseNodeId })])
      .match([
        node('baseNode'),
        relation('out', 'rel', property, { active: true }),
        node('prop', 'Property', { active: true }),
      ])
      .set({
        labels: {
          prop: lables,
        },
      })
      .return('baseNode');
    await addLabel.run();
  }

  assertPatternsIncludeIdentifier(
    patterns: Pattern[][],
    ...identifiers: string[]
  ) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    for (const identifier of identifiers) {
      assert(
        patterns.some((nodes) =>
          nodes.some((node) => node.getNameString() === identifier)
        ),
        `Patterns must define identifier: "${identifier}"`
      );
    }
  }
}
