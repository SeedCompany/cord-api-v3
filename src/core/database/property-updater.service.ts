import { Injectable, NotFoundException } from '@nestjs/common';
import { ForbiddenError } from 'apollo-server-core';
import { Connection, contains, node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import {
  isSecured,
  Order,
  Resource,
  unwrapSecured,
  UnwrapSecured,
} from '../../common';
import { ISession } from '../../components/auth';
import { ILogger, Logger } from '../../core';

@Injectable()
export class PropertyUpdaterService {
  constructor(
    private readonly db: Connection,
    @Logger('PropertyUpdater:service') private readonly logger: ILogger
  ) {}

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

    const now = DateTime.local().toNeo4JDateTime();
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
  }): Promise<{ [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> }> {
    const result: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> } = {};
    for (const prop of props) {
      result[prop] = (await this.readProperty({
        id,
        session,
        aclReadProp: prop as string,
        nodevar,
      })) as UnwrapSecured<TObject[keyof TObject]>;
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
  }): Promise<{
    value: any;
    canEdit?: boolean;
    canRead?: boolean;
  }> {
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

    const result = await this.db
      .query()
      .raw(query, {
        token: session.token,
        userId: session.userId,
        owningOrgId: session.owningOrgId,
        id,
      })
      .run();

    if (!result.length) {
      if (nodevar === 'lang') console.info('QUERY', query, aclReadProp);
      throw new NotFoundException('Could not find requested key');
    }

    return result[0] as {
      value: any;
      canEdit?: boolean;
      canRead?: boolean;
    };
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

    query
      .returnDistinct([
        // return total count
        'total',

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

    const total = result.length ? result[0].total : 0;

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
          const value = row[propName] ? row[propName].split(',') : [];

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
    input: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
    acls: Record<string, boolean>;
    baseNodeLabel: string;
    aclEditProp?: string;
  }): Promise<void> {
    const aclEditPropName =
      aclEditProp || `canEdit${upperFirst(baseNodeLabel)}`;
    await this.createBaseNode<TObject>({
      session,
      baseNodeLabel,
      input,
      acls,
      aclEditProp: aclEditPropName,
    });
    await Promise.all(
      Object.keys(input)
        .filter(key => !(key === 'id' || key === 'userId'))
        .map(async key => {
          await this.createProperty({
            session,
            key,
            value: input[key as keyof TObject] as string,
            id: input.id!,
          });
        })
    );
  }

  async createBaseNode<TObject extends Resource>({
    session,
    baseNodeLabel,
    input,
    acls,
    aclEditProp,
  }: {
    session: ISession;
    baseNodeLabel: string;
    input: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
    acls: Record<string, boolean>;
    aclEditProp?: string;
  }): Promise<void> {
    const aclString = JSON.stringify(acls).replace(/"/g, '');
    const query = `
        MATCH
          (token:Token {
            active: true,
            value: "${session.token}"
          })
          <-[:token {active: true}]-
          (requestingUser:User {
            active: true,
            id: "${session.userId}",
            ${aclEditProp}: true
          })
        CREATE
          (item:${upperFirst(baseNodeLabel)} {
            active: true,
            createdAt: datetime(),
            id: "${input.id}",
            owningOrgId: "${session.owningOrgId}"
          })<-[:toNode]-(acl:ACL
            ${aclString}
          )-[:member]->(requestingUser)
        RETURN item
      `;

    try {
      await this.db
        .query()
        .raw(query, {
          requestingUserId: session.userId,
          token: session.token,
          id: input.id,
        })
        .run();
    } catch (e) {
      const ACLQuery = `MATCH
      (token:Token {
        active: true,
        value: "${session.token}"
      })
      <-[:token {active: true}]-
      (requestingUser:User {
        active: true,
        id: "${session.userId}"
      })
      RETURN requestingUser.${aclEditProp}
      `;

      const result = ((await this.db
        .query()
        .raw(ACLQuery, {})
        .run()) as unknown) as { requestingUser: boolean } | null;
      if (!result || !result.requestingUser) {
        throw new ForbiddenError(`${aclEditProp} missing or false`);
      }
      this.logger.error(`${e} create Node error`);
      throw e;
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
    value: string;
    id: string;
  }) {
    const query = `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId
        }),
        (item {id: $id, active: true})
      CREATE
        (item)-[rel :${key} { active: true , createdAt: datetime(), owningOrgId: $owningOrgId}]->
           (${key}: Property {
             active: true,
             value: "${value}",
             owningOrgId: $owningOrgId
           })
      RETURN
        ${key}.value, rel
      `;

    try {
      await this.db
        .query()
        .raw(query, {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
          key,
          value,
        })
        .run();
    } catch (e) {
      console.log(e);
    }
  }
}
