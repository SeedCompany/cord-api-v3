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
import { cloneDeep, Many, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { assert } from 'ts-essentials';
import {
  isSecured,
  many,
  Order,
  Resource,
  ServerException,
  Session,
  UnauthorizedException,
  unwrapSecured,
  UnwrapSecured,
} from '../../common';
import { ILogger, Logger, ServiceUnavailableError } from '..';
import { AbortError, retry, RetryOptions } from '../../common/retry';
import { ConfigService } from '../config/config.service';
import {
  determineSortValue,
  matchRequestingUser,
  setBaseNodeLabelsAndIdDeleted,
  setPropLabelsAndValuesDeleted,
  UniqueProperties,
} from './query.helpers';
import { hasMore } from './results';

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

  query(): Query {
    return this.db.query();
  }

  async getServerInfo() {
    const info = await this.db
      .query()
      .raw(
        `call dbms.components()
         yield name, versions, edition
         unwind versions as version
         return name, version, edition`
      )
      .asResult<{ name: string; version: string; edition: string }>()
      .first();
    if (!info) {
      throw new ServerException('Unable to determine server info');
    }
    return info;
  }

  async sgUpdateProperties<TObject extends Resource>({
    session,
    object,
    props,
    changes,
    nodevar,
  }: {
    session: Session;
    object: TObject;
    props: ReadonlyArray<keyof TObject & string>;
    changes: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
    nodevar: string;
  }) {
    let updated = object;
    for (const prop of props) {
      if (
        changes[prop] === undefined ||
        unwrapSecured(object[prop]) === changes[prop]
      ) {
        continue;
      }
      updated = await this.sgUpdateProperty({
        object: updated,
        session,
        key: prop,
        value: changes[prop],
        nodevar,
      });
    }
    return updated;
  }

  async sgUpdateProperty<
    TObject extends Resource,
    Key extends keyof TObject & string
  >({
    session,
    object,
    key,
    value,
    nodevar,
  }: {
    session: Session;
    object: TObject;
    key: Key;
    value?: UnwrapSecured<TObject[Key]>;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<TObject> {
    const createdAt = DateTime.local();
    const nodePropsToUpdate = {
      createdAt,
      value,
      sortValue: determineSortValue(value),
    };
    const update = this.db
      .query()
      .match([matchSession(session)])
      .match([
        node(nodevar, upperFirst(nodevar), {
          id: object.id,
        }),
      ])
      .match([
        node('requestingUser'),
        relation('in', 'memberOfSecurityGroup', 'member'),
        node('securityGroup', 'SecurityGroup'),
        relation('out', 'sgPerms', 'permission'),
        node('perms', 'Permission', {
          property: key as string,
          // admin: true,
          edit: true,
        }),
        relation('out', 'permsOfBaseNode', 'baseNode'),
        node(nodevar),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property'),
      ])
      .setValues({
        'oldToProp.active': false,
      })
      .with('*')
      .limit(1)
      .create([
        node(nodevar),
        relation('out', 'toProp', key as string, {
          active: true,
          createdAt,
        }),
        node('newPropNode', 'Property', nodePropsToUpdate),
      ])
      .return('newPropNode');
    let result;

    try {
      result = await update.first();
    } catch (e) {
      this.logger.error('Neo4jError ', e);
      throw new ServerException('Failed to update property', e);
    }

    if (!result) {
      throw new UnauthorizedException(
        `You do not have permission to update property: ${key}`,
        key
      );
    }

    return {
      ...object,
      ...(isSecured(object[key])
        ? // replace value in secured object keeping can* properties
          {
            [key]: {
              ...object[key],
              value,
            },
          }
        : // replace value directly
          { [key]: value }),
    };
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
    owningOrgId?: string;
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
        const propName = (typeof prop === 'object'
          ? prop.name
          : prop) as string;
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
          const propName = (typeof prop === 'object'
            ? prop.name
            : prop) as string;
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
        const propName = (typeof prop === 'object'
          ? prop.name
          : prop) as string;
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

  async checkDeletePermission(id: string, session: Partial<Session>) {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match(node('node', { id }))
      .match([
        node('requestingUser'),
        relation('in', 'memberOfSecurityGroup', 'member'),
        node('securityGroup', 'SecurityGroup'),
        relation('out', 'sgPerms', 'permission'),
        node('perm', 'Permission', { read: true, property: 'canDelete' }),
        relation('out', 'permsOfBaseNode', 'baseNode'),
        node('node'),
      ])
      .return('perm');

    const result = await query.first();
    return !!result;
  }

  async deleteNodeNew<TObject extends Resource>({
    object,
    baseNodeLabels,
    uniqueProperties = {},
  }: {
    object: TObject;
    baseNodeLabels: string[];
    uniqueProperties?: UniqueProperties<TObject>;
  }) {
    const query = this.db
      .query()
      .match(node('node', { id: object.id }))
      //Mark any parent base node relationships (pointing to the base node) as active = false.
      .optionalMatch([
        node('node'),
        relation('in', 'rel'),
        node('', 'BaseNode'),
      ])
      .set({
        values: {
          'rel.active': false,
        },
      })
      .with('distinct(node) as node')
      //Mark baseNode labels and id deleted
      .call(setBaseNodeLabelsAndIdDeleted, baseNodeLabels)
      //Mark unique property labels and values deleted
      .call(setPropLabelsAndValuesDeleted, uniqueProperties)
      .return('*');
    await query.run();
  }

  async deleteNode<TObject extends Resource>({
    session,
    object,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    aclEditProp, // example canCreateLangs
  }: {
    session: Session;
    object: TObject;
    aclEditProp: string;
  }) {
    await this.db
      .query()
      .raw(
        `
        MATCH
        (token:Token {
          active: true,
          value: $token
        })
        <-[:token {active: true}]-
        (requestingUser:User {

          id: $requestingUserId
        }),
        (object {

          id: $objectId
        })
        detach delete object

        `,
        {
          requestingUserId: session.userId,
          token: session.token,
          objectId: object.id,
        }
      )
      .run();
  }

  async hasProperties({
    session,
    id,
    props,
    nodevar,
  }: {
    id: string;
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
    id: string;
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
    id: string;
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
    id: string;
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
    id: string;
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
    baseNodeId: string,
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
