import { Injectable, NotFoundException } from '@nestjs/common';
import { ForbiddenError } from 'apollo-server-core';
import {
  Connection,
  contains,
  node,
  Query,
  relation,
} from 'cypher-query-builder';
import { cloneDeep, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import {
  isSecured,
  Order,
  Resource,
  unwrapSecured,
  UnwrapSecured,
} from '../../common';
import { ISession } from '../../components/auth';
import { ILogger, Logger } from '..';

interface ReadPropertyResult {
  value: any;
  canEdit: boolean;
  canRead: boolean;
}

@Injectable()
export class DatabaseService {
  constructor(
    private readonly db: Connection,
    @Logger('database:service') private readonly logger: ILogger
  ) {}

  query(): Query {
    return this.db.query();
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
  }) {
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
    const result = await this.db
      .query()
      .match([
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
        }),
      ])
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
      .return('newPropNode')
      .first();

    if (!result) {
      throw new NotFoundException('Could not find object');
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
  }: {
    id: string;
    session: ISession;
    props: ReadonlyArray<keyof TObject>;
    nodevar: string;
  }): Promise<{ [Key in keyof TObject]: ReadPropertyResult }> {
    const result: { [Key in keyof TObject]: ReadPropertyResult } = {} as any;
    for (const prop of props) {
      result[prop] = await this.readProperty({
        id,
        session,
        aclReadProp: prop as string,
        nodevar,
      });
    }
    return result;
  }

  async readProperty<TObject extends Resource>({
    id,
    session,
    nodevar,
    aclReadProp,
  }: {
    id: string;
    session: ISession;
    nodevar: string;
    aclReadProp: string;
  }): Promise<ReadPropertyResult> {
    const aclReadPropName = `canRead${upperFirst(aclReadProp)}`;
    const aclEditPropName = `canEdit${upperFirst(aclReadProp)}`;
    const aclReadNodeName = `canRead${upperFirst(nodevar)}s`;
    let content: string,
      type: string = nodevar;

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
      .run()) as ReadPropertyResult[];

    if (!result.length) {
      throw new NotFoundException('Could not find requested key');
    }

    const property = result[0];
    return property;
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

    const query = this.db.query().match([
      [
        node('token', 'Token', {
          active: true,
          value: session.token,
        }),
        relation('in', '', 'token', {
          active: true,
        }),
        node('requestingUser', 'User', {
          active: true,
          [aclReadPropName]: true,
        }),
      ],
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
    query.with('count(n) as total, requestingUser');

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

    if (input.filter && Object.keys(input.filter).length) {
      const where: Record<string, any> = {};
      for (const k in input.filter) {
        if (k !== 'id' && k !== 'userId') {
          where[k + '.value'] = contains(input.filter[k]);
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
        ...props.map(prop => {
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

    // if skip + count is less than total, there is more
    const hasMore = (input.page - 1) * input.count + input.count < total;

    const items = result.map<TObject>(row => {
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
          const value = row[propName] ? row[propName] : [];

          if (secure) {
            item[propName] = {
              value,
              canRead: Boolean(row[aclReadPropName]),
              canEdit: Boolean(row[aclEditPropName]),
            };
          } else {
            item[propName] = value;
          }
        } else {
          if (secure) {
            item[propName] = {
              value: row[propName],
              canRead: Boolean(row[aclReadPropName]),
              canEdit: Boolean(row[aclEditPropName]),
            };
          } else {
            item[propName] = row[propName];
          }
        }
      }

      return item;
    });

    return {
      hasMore,
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
    this.logger.info(``);
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
      .match([
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
        }),
      ])
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
      throw new NotFoundException('Could not find object');
    }
  }

  async createNode<TObject extends Resource>({
    session,
    input,
    acls,
    baseNodeLabel,
    aclEditProp,
  }: {
    session: ISession;
    input: { [Key in keyof TObject]?: any };
    acls: Record<string, boolean>;
    baseNodeLabel: string;
    aclEditProp?: string;
  }): Promise<void> {
    await this.createBaseNode<TObject>({
      session,
      baseNodeLabel,
      input,
      acls,
      aclEditProp,
    });

    for (const k in input) {
      if (k === 'id') {
        continue;
      }

      await this.createProperty({
        session,
        key: k,
        value: input[k],
        id: input.id,
      });
    }
  }

  private async createBaseNode<TObject extends Resource>({
    session,
    baseNodeLabel,
    input,
    acls,
    aclEditProp,
  }: {
    session: ISession;
    baseNodeLabel: string;
    input: { [Key in keyof TObject]?: any };
    acls: Record<string, boolean>;
    aclEditProp?: string;
  }): Promise<void> {
    try {
      await this.db
        .query()
        .match([
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
            ...(aclEditProp ? { [aclEditProp]: true } : {}),
          }),
        ])
        .create([
          node('item', upperFirst(baseNodeLabel), {
            active: true,
            createdAt: DateTime.local(),
            id: input.id,
            owningOrgId: session.owningOrgId,
          }),
          relation('in', '', 'toNode'),
          node('acl', 'ACL', acls),
          relation('out', '', 'member'),
          node('requestingUser'),
        ])
        .run();
    } catch (e) {
      // If there is no aclEditProp, then this is not an access-related issue and we can move forward with throwing
      if (!aclEditProp) {
        throw e;
      }

      // Retrieve the user's record of the aclEditProp, if it exists
      const aclResult = await this.db
        .query()
        .match([
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
          relation('in', '', 'token'),
          node('requestingUser', 'User', {
            active: true,
            id: session.userId,
          }),
        ])
        .return({
          requestingUser: [{ aclEditProp: 'editProp' }],
        })
        .first();

      // If the user doesn't have permission to perform the create action...
      if (!aclResult || !aclResult.editProp) {
        throw new ForbiddenError(`${aclEditProp} missing or false`);
      }

      this.logger.error(`DatabaseService create error`, {
        exception: e,
      });

      throw e;
    }
  }

  private async createProperty<TObject extends Resource>({
    session,
    key,
    value,
    id,
  }: {
    session: ISession;
    key: string;
    value?: any;
    id: string;
  }) {
    await this.db
      .query()
      .match([
        [
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
          }),
        ],
        [
          node('item', {
            id,
            active: true,
          }),
        ],
      ])
      .create([
        node('item'),
        relation('out', 'rel', `${key}`, {
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
}
