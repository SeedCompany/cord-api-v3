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
import { cloneDeep, Many, upperFirst, without } from 'lodash';
import { DateTime, Duration } from 'luxon';
import { generate } from 'shortid';
import { assert } from 'ts-essentials';
import {
  AbstractClassType,
  InputException,
  ISession,
  isSecured,
  many,
  mapFromList,
  Order,
  Resource,
  ServerException,
  UnauthorizedException,
  UnwrapSecured,
  unwrapSecured,
} from '../../common';
import { ILogger, Logger } from '..';
import { ConfigService } from '../config/config.service';
import { hasMore } from './query.helpers';

interface ReadPropertyResult {
  value: any;
  canEdit: boolean;
  canRead: boolean;
}

type ResourceInput<T extends Resource> = {
  // id is required
  id: string;
} & {
  // all other props are optional and their raw unsecured value
  [Key in keyof T]?: UnwrapSecured<T[Key]>;
} &
  // Allow other unknown properties as well
  Record<string, DbValue>;

export type ACLs = Record<string, boolean>;

/** A value that con be passed into the db */
export type DbValue = Many<
  string | number | boolean | DateTime | Duration | null | undefined
>;

export const matchSession = (
  session: ISession,
  {
    withAclEdit,
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
    active: true,
    id: session.userId,
    ...(withAclEdit ? { [withAclEdit]: true } : {}),
    ...(withAclRead ? { [withAclRead]: true } : {}),
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

  query(): Query {
    return this.db.query();
  }

  async addRootAdminToBaseNodeAsAdmin(newBaseNodeId: string, label: string) {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .match([
        node('root', 'User', {
          active: true,
          id: this.config.rootAdmin.id,
        }),
      ])
      .match([
        node('node', label, {
          active: true,
          id: newBaseNodeId,
        }),
      ])
      .merge([
        node('root'),
        relation('in', '', 'admin', {
          active: true,
          createdAt,
        }),
        node('node'),
      ])
      .run();
  }

  async updateProperties<TObject extends Resource>({
    session,
    object,
    props,
    changes,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
    changes: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
    nodevar: string;
  }): Promise<TObject> {
    let updated = object;
    for (const prop of props) {
      if (
        changes[prop] == null ||
        unwrapSecured(object[prop]) === changes[prop]
      ) {
        continue;
      }
      updated = await this.updateProperty({
        object: updated,
        session,
        key: prop,
        value: changes[prop],
        nodevar,
      });
    }
    return updated;
  }

  async updateProperty<TObject extends Resource, Key extends keyof TObject>({
    session,
    object,
    key,
    value,
    aclEditProp,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    key: Key;
    value?: UnwrapSecured<TObject[Key]>;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<TObject> {
    const aclEditPropName =
      aclEditProp || `canEdit${upperFirst(key as string)}`;

    const now = DateTime.local();
    const update = this.db
      .query()
      .match([matchSession(session)])
      .with('*')
      .optionalMatch([
        node(nodevar, upperFirst(nodevar), {
          active: true,
          id: object.id,
          owningOrgId: session.owningOrgId,
        }),
      ])
      .with('*')
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('acl', 'ACL', { [aclEditPropName]: true }),
        relation('out', '', 'toNode'),
        node(nodevar),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property', { active: true }),
      ])
      .setValues({
        'oldToProp.active': false,
        'oldPropVar.active': false,
      })
      .create([
        node(nodevar),
        relation('out', 'toProp', key as string, {
          active: true,
          createdAt: now,
          owningOrgId: session.owningOrgId,
        }),
        node('newPropNode', 'Property', {
          active: true,
          createdAt: now,
          value,
          owningOrgId: session.owningOrgId,
        }),
      ])
      .return('newPropNode');

    const result = await update.first();

    if (!result) {
      throw new InputException('Could not find object');
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

  async readProperties<TObject extends Resource>({
    id,
    session,
    props,
    nodevar,
    aclReadNode,
  }: {
    id: string;
    session: ISession;
    props: ReadonlyArray<keyof TObject>;
    nodevar: string;
    aclReadNode?: string;
  }): Promise<{ [Key in keyof TObject]: ReadPropertyResult }> {
    const result: { [Key in keyof TObject]: ReadPropertyResult } = {} as any;
    for (const prop of props) {
      result[prop] = await this.readProperty({
        id,
        session,
        aclReadProp: prop as string,
        aclReadNode,
        nodevar,
      });
    }
    return result;
  }

  async hasSgReadProperty<TObject extends Resource>({
    id,
    session,
    property,
    nodevar,
  }: {
    id: string;
    session: ISession;
    property: string;
    nodevar: string;
  }): Promise<boolean> {
    let type: string = upperFirst(nodevar);

    if (nodevar === 'Lang') {
      type = 'Language';
    }
    const query = this.db.query();
    if (session.userId) {
      query.match([matchSession(session, {})]);
    }

    query.match([
      [
        // node('requestingUser'),
        // relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perm', 'Permission', {
          property,
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('n', type, { active: true, id }),
        relation('out', '', property, { active: true }),
        node([property], 'Property', { active: true }),
      ],
    ]);

    query.return(['sg', 'perm', 'n', property]);

    let result;
    try {
      result = await query.run();
    } catch (e) {
      this.logger.error(e);
    }

    return !!result;
  }

  async hasACLReadProperty<TObject extends Resource>({
    session,
    nodevar,
    aclReadProp,
    aclReadNode,
  }: {
    session: ISession;
    nodevar: string;
    aclReadProp: string;
    aclReadNode?: string;
  }): Promise<boolean> {
    const aclReadPropName = `canRead${upperFirst(aclReadProp)}`;
    const aclEditPropName = `canEdit${upperFirst(aclReadProp)}`;

    const aclReadNodeName = aclReadNode || `canRead${upperFirst(nodevar)}s`;

    const query = this.db.query().match([matchSession(session, {})]);
    query.match([
      node('requestingUser', 'User', { [aclReadNodeName]: true }),
      relation('in', '', 'member'),
      node('acl', 'ACL', { active: true, [aclReadPropName]: true }),
      relation('out', '', 'toNode', { active: true }),
      node(nodevar),
      relation('out', 'rel', aclReadProp, { active: true }),
      node(aclReadProp, 'Property', { active: true }),
    ]);
    query.return(`${aclReadProp}.value as value, acl.${aclReadPropName} as canRead, acl.${aclEditPropName} as canEdit
    `);
    let result;
    try {
      result = await query.first();
    } catch (e) {
      this.logger.error(e);
    }

    return !!result;
  }

  async sgReadProperties<TObject extends Resource>({
    id,
    session,
    props,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: string[];
    nodevar: string;
  }): Promise<any | undefined> {
    // this.logger.debug('sgReadProperties', { id, session, props, nodevar });
    let type: string = upperFirst(nodevar);

    if (nodevar === 'Lang') {
      type = 'Language';
    }
    const query = this.db.query();
    if (session.userId) {
      query.match([matchSession(session, {})]);
      query.match([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
      ]);
    }
    const nonMetaProps = without(props, 'id', 'createdAt');
    const permNodes = nonMetaProps.map((p) => `perm${p}`);

    for (const property of nonMetaProps) {
      query.match([
        [
          node('sg', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission'),
          node(`perm${property}`, 'Permission', {
            property,
            read: true,
            active: true,
          }),
          relation('out', '', 'baseNode'),
          node('n', type, { active: true, id }),
          relation('out', '', property, { active: true }),
          node(property, 'Property', { active: true }),
        ],
      ]);
    }
    query.return(['sg', 'n', ...nonMetaProps, ...permNodes]);

    let result: { sg: any; perm: any; p: any; n: any } | any | undefined;
    try {
      result = await query.first();
    } catch (e) {
      this.logger.error(e);
    }

    if (!result) {
      return undefined;
    }

    return {
      id: { value: id, canRead: true, canEdit: true },
      createdAt: {
        value: result.n.properties.createdat,
        canRead: true,
        canEdit: true,
      },
      ...mapFromList(nonMetaProps, (property) => {
        const val = {
          value: result[property].properties.value,
          canRead: result['perm' + property].properties.read,
          canEdit: result['perm' + property].properties.edit,
        };
        return [property, val];
      }),
    };
  }

  async sgUpdateProperties<TObject extends Resource>({
    session,
    object,
    props,
    changes,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
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

  async sgUpdateProperty<TObject extends Resource, Key extends keyof TObject>({
    session,
    object,
    key,
    value,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    key: Key;
    value?: UnwrapSecured<TObject[Key]>;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<TObject> {
    const createdAt = DateTime.local();
    const update = this.db
      .query()
      .match([matchSession(session)])
      .match([
        node(nodevar, upperFirst(nodevar), {
          id: object.id,
          active: true,
        }),
      ])
      .match([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('', 'Permission', {
          property: key as string,
          active: true,
          // admin: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(nodevar),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property', { active: true }),
      ])
      .setValues({
        'oldToProp.active': false,
        'oldPropVar.active': false,
      })
      .create([
        node(nodevar),
        relation('out', 'toProp', key as string, {
          active: true,
          createdAt,
          owningOrgId: session.owningOrgId,
        }),
        node('newPropNode', 'Property', {
          active: true,
          createdAt,
          value,
        }),
      ])
      .return('newPropNode');
    let result;

    try {
      result = await update.first();
    } catch (e) {
      this.logger.error('Neo4jError ', e);
    }

    if (!result) {
      throw new InputException('Could not find object');
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

  async readProperty<TObject extends Resource>({
    id,
    session,
    nodevar,
    aclReadProp,
    aclReadNode,
  }: {
    id: string;
    session: ISession;
    nodevar: string;
    aclReadProp: string;
    aclReadNode?: string;
  }): Promise<ReadPropertyResult> {
    const aclReadPropName = `canRead${upperFirst(aclReadProp)}`;
    const aclEditPropName = `canEdit${upperFirst(aclReadProp)}`;

    const aclReadNodeName = aclReadNode || `canRead${upperFirst(nodevar)}s`;
    let content: string;
    let type = nodevar;

    if (nodevar === 'lang') {
      type = 'language';
    }

    if (aclReadProp === 'id' || aclReadProp === 'createdAt') {
      content = `
      (${nodevar}:${upperFirst(type)} { active: true, id: $id })
      return ${nodevar}.${aclReadProp} as value, ${nodevar}.${aclReadNodeName} as canRead, null as canEdit
      `;
    } else {
      content = `
      (${nodevar}: ${upperFirst(type)} { active: true, id: $id })
      WITH * OPTIONAL MATCH (user)<-[:member]-(acl:ACL { ${aclReadPropName}: true })
      -[:toNode]->(${nodevar})-[:${aclReadProp} {active: true}]->(${aclReadProp}:Property {active: true})
      RETURN ${aclReadProp}.value as value, acl.${aclReadPropName} as canRead, acl.${aclEditPropName} as canEdit
      `;
    }

    const query = `
    match  (token:Token {
      active: true,
      value: $token
    })
    <-[:token { active: true }]-
    (user:User {  ${aclReadNodeName}: true }),${content}`;

    const result = (await this.db
      .query()
      .raw(query, {
        token: session.token,
        userId: session.userId,
        owningOrgId: session.owningOrgId,
        id,
      })
      .first()) as ReadPropertyResult;

    if (!result) {
      return { value: null, canRead: false, canEdit: false };
    }

    return result;
  }

  async list<TObject extends Resource>({
    session,
    props,
    nodevar,
    owningOrgId,
    skipOwningOrgCheck,
    aclReadProp,
    aclEditProp,
    input,
  }: {
    session: ISession;
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
    const owningOrgFilter = skipOwningOrgCheck
      ? {}
      : { owningOrgId: owningOrgId || session.owningOrgId };
    const idFilter = input.filter.id ? { id: input.filter.id } : {};
    const userIdFilter = input.filter.userId ? { id: input.filter.userId } : {};
    const mineFilter = input.filter.mine ? { id: session.userId } : {};

    const query = this.db.query().match([
      matchSession(session, {
        withAclRead: aclReadPropName,
      }),
    ]);

    if (Object.keys(userIdFilter).length) {
      query.match([
        [
          node('user', 'User', {
            active: true,
            ...userIdFilter,
          }),
          relation('out', '', nodevar, {
            active: true,
          }),
          node('n', nodeName, {
            active: true,
            ...idFilter,
          }),
        ],
      ]);
    } else {
      query.match([
        node('n', nodeName, {
          active: true,
          ...idFilter,
        }),
      ]);
    }
    if (mineFilter.id) {
      query.match([
        [
          node('requestingUser'),
          relation('in', '', 'user', { active: true }),
          node('projectMember', 'ProjectMember', { active: true }),
          relation('out', '', 'roles', { active: true }),
          node('role', 'Property', {
            active: true,
            value: ['ProjectManager'],
          }),
        ],
        [
          node('projectMember'),
          relation('in', '', 'member', { active: true }),
          node('n'),
        ],
      ]);
    }
    query.with('count(n) as total, requestingUser, n');

    for (const prop of props) {
      const propName = typeof prop === 'object' ? prop.name : prop;

      query.optionalMatch([
        node('n', nodeName, {
          active: true,
          ...owningOrgFilter,
        }),
        relation('out', '', propName as string, { active: true }),
        node(propName as string, 'Property', { active: true }),
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

  async deleteNode<TObject extends Resource>({
    session,
    object,
    aclEditProp, // example canCreateLangs
  }: {
    session: ISession;
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
          active: true,
          id: $requestingUserId,
          ${aclEditProp}: true
        }),
        (object {
          active: true,
          id: $objectId
        })
        SET
          object.active = false
        RETURN
          object.id as id
        `,
        {
          requestingUserId: session.userId,
          token: session.token,
          objectId: object.id,
        }
      )
      .run();
  }

  async deleteProperties<TObject extends Resource>({
    session,
    object,
    props,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
    nodevar: string;
  }) {
    for (const prop of props) {
      await this.deleteProperty({
        object,
        session,
        key: prop,
        nodevar,
      });
    }
  }

  async deleteProperty<TObject extends Resource, Key extends keyof TObject>({
    session,
    object,
    key,
    aclEditProp,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    key: Key;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<void> {
    const aclEditPropName =
      aclEditProp || `canEdit${upperFirst(key as string)}`;

    const result = await this.db
      .query()
      .match([matchSession(session)])
      .with('*')
      .optionalMatch([
        node(nodevar, upperFirst(nodevar), {
          active: true,
          id: object.id,
          owningOrgId: session.owningOrgId,
        }),
      ])
      .with('*')
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('acl', 'ACL', { [aclEditPropName]: true }),
        relation('out', '', 'toNode'),
        node(nodevar),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property', { active: true }),
      ])
      .setValues({
        'oldToProp.active': false,
        'oldPropVar.active': false,
      })
      .return('oldPropNode')
      .first();

    if (!result) {
      throw new InputException('Could not find object');
    }
  }

  async createNode<TObject extends Resource>({
    session,
    type,
    input: { id, ...props },
    acls,
    baseNodeLabel,
    aclEditProp,
  }: {
    session: ISession;
    type: AbstractClassType<TObject>;
    input: ResourceInput<TObject>;
    acls: ACLs;
    baseNodeLabel?: Many<string>;
    aclEditProp?: string | false;
  }): Promise<void> {
    await this.createBaseNode<TObject>({
      session,
      type,
      input: { id, ...props },
      acls,
      baseNodeLabel,
      aclEditProp,
    });

    for (const [key, value] of Object.entries(props)) {
      await this.createProperty({
        session,
        key,
        value,
        id,
      });
    }
  }

  async createBaseNode<TObject extends Resource>({
    session,
    type,
    input,
    acls,
    baseNodeLabel,
    aclEditProp,
  }: {
    session: ISession;
    type: AbstractClassType<TObject>;
    input: ResourceInput<TObject>;
    acls: ACLs;
    baseNodeLabel?: Many<string>;
    aclEditProp?: string | false;
  }): Promise<void> {
    const labels = (baseNodeLabel ? many(baseNodeLabel) : [type.name]).map(
      upperFirst
    );
    const aclEdit = aclEditProp ?? `canCreate${labels[0]}`;

    try {
      await this.db
        .query()
        .match([
          matchSession(session, {
            withAclEdit: aclEdit || undefined,
          }),
        ])
        .create([
          [
            node('item', [...labels, 'BaseNode'], {
              active: true,
              createdAt: DateTime.local(),
              id: input.id,
              owningOrgId: session.owningOrgId,
            }),
            relation('in', '', 'toNode'),
            node('acl', 'ACL', acls),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [
            node('item'),
            relation('out', '', 'admin', {
              active: true,
              createdAt: DateTime.local(),
              hidden: false,
              owner: true,
            }),
            node('requestingUser'),
          ],
        ])
        .run();
    } catch (exception) {
      // If there is no aclEditProp, then this is not an access-related issue
      // and we can move forward with throwing
      if (!aclEdit) {
        throw new ServerException('Could not found aclEdit');
      }

      // Retrieve the user's record of the aclEditProp, if it exists
      const aclResult = await this.db
        .query()
        .match([matchSession(session)])
        .return({
          requestingUser: [{ [aclEdit]: 'editProp' }],
        })
        .first();

      // If the user doesn't have permission to perform the create action...
      if (!aclResult || !aclResult.editProp) {
        throw new UnauthorizedException(`Cannot create ${type.name}`);
      }

      this.logger.error(`createNode error`, {
        exception,
      });

      throw new ServerException('createNode error', exception);
    }
  }

  async createProperty({
    session,
    key,
    value,
    id,
  }: {
    session: ISession;
    key: string;
    value: DbValue;
    id: string;
  }) {
    await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('item', {
            id,
            active: true,
          }),
        ],
      ])
      .create([
        node('item'),
        relation('out', 'rel', key, {
          active: true,
          createdAt: DateTime.local(),
          owningOrgId: session.owningOrgId,
        }),
        node(key, 'Property', {
          active: true,
          value,
          owningOrgId: session.owningOrgId,
        }),
      ])
      .return([`${key}.value`, 'rel'])
      .run();
  }

  async hasProperties({
    session,
    id,
    props,
    nodevar,
  }: {
    id: string;
    session: ISession;
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
    session: ISession;
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
    session: ISession;
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
    session: ISession;
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
    session: ISession;
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
    //.first();

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
    // const printme = addLabel;
    // console.log('printme :>> ', printme.interpolate());
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

  async sgCreateNode<TObject>({
    session,
    input,
    propLabels,
    nodevar,
    aclEditProp,
    sgName,
  }: {
    session: ISession;
    input: TObject;
    propLabels: TObject;
    nodevar: string;
    aclEditProp?: string;
    sgName: string;
  }) {
    const id = generate();
    const createdAt = DateTime.local();
    const nodeName = upperFirst(nodevar);
    const aclEditPropName = aclEditProp || `canEdit${nodeName}`;
    const baseNode = nodeName + ':BaseNode';
    const isRootSGMember = await this.isRootSecurityGroupMember(session);
    const properties = Object.entries(input).flatMap(([key, val]) => {
      const propLabel = propLabels[key as keyof TObject];
      return this.sgProperty(key, val, propLabel);
    });
    const permissions = Object.keys(input).flatMap((key) =>
      isRootSGMember ? this.rootSGPermission(key) : this.sgPermission(key)
    );
    try {
      const permissionQueries = isRootSGMember
        ? [
            [
              node('rootSG', 'RootSecurityGroup', {
                active: true,
                createdAt,
                name: sgName + ' root',
                id: generate(),
              }),
              relation('out', '', 'member', { active: true, createdAt }),
              node('requestingUser'),
            ],
            ...permissions,
          ]
        : [
            [
              node('adminSG', 'SecurityGroup', {
                id: generate(),
                active: true,
                createdAt,
                name: sgName + ' admin',
              }),
              relation('out', '', 'member', { active: true, createdAt }),
              node('requestingUser'),
            ],
            [
              node('readerSG', 'SecurityGroup', {
                id: generate(),
                active: true,
                createdAt,
                name: sgName + ' users',
              }),
              relation('out', '', 'member', { active: true, createdAt }),
              node('requestingUser'),
            ],
            [
              node('adminSG'),
              relation('out', '', 'member', { active: true, createdAt }),
              node('rootuser'),
            ],
            [
              node('readerSG'),
              relation('out', '', 'member', { active: true, createdAt }),
              node('rootuser'),
            ],
            ...permissions,
          ];

      const query = this.db
        .query()
        .match(matchSession(session, { withAclEdit: aclEditPropName }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newNode', baseNode, {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...properties,
          ...permissionQueries,
        ])
        .return('newNode.id as id');
      const result = await query.first();

      if (!result) {
        throw new ServerException('failed to create node');
      }
      return result.id;
    } catch (exception) {
      this.logger.error(`Could not create node`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not create node', exception);
    }
  }

  // helper method for defining properties
  sgProperty = (prop: string, value: any, propLabel: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const property = (propLabel as string)
      ? (propLabel as string) + ':Property'
      : 'Property';
    return [
      [
        node('newNode'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, property, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  sgPermission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newNode'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newNode'),
      ],
    ];
  };

  rootSGPermission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('rootSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          root: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newNode'),
      ],
    ];
  };

  async sgReadOne({
    id,
    session,
    props,
    aclReadProp,
    aclEditProp,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: string[];
    aclReadProp?: string;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<any | undefined> {
    const nodeName = upperFirst(nodevar);
    const aclReadPropName = aclReadProp || `canRead${nodeName}s`;
    const aclCreatePropName = aclEditProp || `canCreate${nodeName}`;
    const output = {
      node: [{ id: 'id', createdAt: 'createdAt' }],
      requestingUser: [
        {
          [aclReadPropName]: aclReadPropName,
          [aclCreatePropName]: aclCreatePropName,
        },
      ],
    };

    if (await this.isRootSecurityGroupMember(session)) {
      const rootOutput = {
        baseNode: [{ id: 'id', createdAt: 'createdAt' }],
      };
      const qry = this.db
        .query()
        .match([node('baseNode', nodeName, { active: true, id: id })]);
      for (const prop of props) {
        qry.optionalMatch([
          node('baseNode'),
          relation('out', 'rel', prop, { active: true }),
          node(prop, 'Property', { active: true }),
        ]);
        Object.assign(rootOutput, { [prop]: [{ value: prop }] });
      }

      const rootResult = await qry.return(rootOutput).first();
      return {
        id: rootResult!.id,
        createdAt: rootResult!.createdAt,
        ...mapFromList(props, (prop) => {
          const val = {
            value: rootResult![prop],
            canRead: true,
            canEdit: true,
          };
          return [prop, val];
        }),
      };
    }
    const query = this.db
      .query()
      .match(matchSession(session, { withAclEdit: aclReadPropName }))
      .match([node('node', nodeName, { active: true, id: id })]);

    for (const property of props) {
      const readPerm = 'canRead' + upperFirst(property);
      const editPerm = 'canEdit' + upperFirst(property);
      query.optionalMatch([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('sg', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node(editPerm, 'Permission', {
            property,
            active: true,
            edit: true,
          }),
          relation('out', '', 'baseNode', { active: true }),
          node('node'),
          relation('out', '', property, { active: true }),
          node(property, 'Property', { active: true }),
        ],
      ]);
      query.optionalMatch([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('sg', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node(readPerm, 'Permission', {
            property,
            active: true,
            read: true,
          }),
          relation('out', '', 'baseNode', { active: true }),
          node('node'),
          relation('out', '', property, { active: true }),
          node(property, 'Property', { active: true }),
        ],
      ]);

      Object.assign(output, {
        [readPerm]: [{ read: readPerm }],
        [editPerm]: [{ edit: editPerm }],
      });
      Object.assign(output, { [property]: [{ value: property }] });
    }

    query.return(output);
    let result: any;
    try {
      result = await query.first();
    } catch (exception) {
      this.logger.error(`Could not find node`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not find node', exception);
    }

    if (!result) {
      throw new InputException('Could not find node');
    }
    if (!result[aclCreatePropName]) {
      throw new UnauthorizedException(
        'User does not have permission to create an node'
      );
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      ...mapFromList(props, (property) => {
        const val = {
          value: result[property],
          canRead: !!result['canRead' + upperFirst(property)],
          canEdit: !!result['canEdit' + upperFirst(property)],
        };
        return [property, val];
      }),
    };
  }

  async isRootSecurityGroupMember(session: ISession): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('user', 'User', { active: true, id: session.userId }),
          relation('in', '', 'member', { active: true }),
          node('rSg', 'RootSecurityGroup', { active: true }),
        ],
      ])
      .return('count(user) as total')
      .first();

    return (result?.total || 0) > 0;
  }
}
