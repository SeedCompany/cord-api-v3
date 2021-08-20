import { Injectable } from '@nestjs/common';
import { oneLine } from 'common-tags';
import {
  Connection,
  equals,
  node,
  Query,
  regexp,
  relation,
} from 'cypher-query-builder';
import type { Pattern } from 'cypher-query-builder/dist/typings/clauses/pattern';
import { cloneDeep, last, Many, startCase, uniq, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { assert } from 'ts-essentials';
import {
  entries,
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
import { DbChanges } from './changes';
import { ACTIVE, deleteBaseNode, exp, updateProperty } from './query';
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
    node(propVar, uniq(['Property', ...many(extraPropLabel ?? [])]), {
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

  async createFullTextIndex(
    name: string,
    labels: string[],
    properties: string[],
    config: { analyzer?: string; eventuallyConsistent?: boolean }
  ) {
    const exists = await this.query(
      `call db.indexes() yield name where name = '${name}' return name limit 1`
    ).first();
    if (exists) {
      return;
    }
    const quote = (q: string) => `'${q}'`;
    await this.query(
      oneLine`
        CALL db.index.fulltext.createNodeIndex(
          ${quote(name)},
          ${exp(labels.map(quote))},
          ${exp(properties.map(quote))},
          ${exp({
            analyzer: config.analyzer ? quote(config.analyzer) : undefined,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            eventually_consistent: config.eventuallyConsistent
              ? exp(config.eventuallyConsistent)
              : undefined,
          })}
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

  /**
   * @deprecated Construct list query manually and use our helper methods for pagination
   */
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

    const query: Query<any> = this.db.query().match([
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
        relation('out', '', propName as string, ACTIVE),
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
    const countQuery =
      cloneDeep(query).return<{ total: number }>('count(n) as total');

    query
      .returnDistinct<any>([
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
      .apply(deleteBaseNode('baseNode'))
      .return('*');
    await query.run();
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
