import { Connection, node, relation } from 'cypher-query-builder';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Resource,
  UnwrapSecured,
  isSecured,
  unwrapSecured,
} from '../../common';
import { User } from '../../components/user/dto';
import { ILogger, Logger } from '../../core';
import { DateTime } from 'luxon';
import { ISession } from '../../components/auth';
import { upperFirst } from 'lodash';
import { convertToObject } from 'typescript';
import { ObjectType } from 'type-graphql';
import { ForbiddenError } from 'apollo-server-core';

@Injectable()
export class PropertyUpdaterService {
  constructor(
    private readonly db: Connection,
    @Logger('PropertyUpdater:service') private readonly logger: ILogger,
  ) { }

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
        object,
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
    value: UnwrapSecured<TObject[Key]>;
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
        }),
        node('newPropNode', 'Property', {
          active: true,
          createdAt: now,
          value,
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

  async readProperties({
    id,
    session,
    props,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: ReadonlyArray<string>;
    nodevar: string;
  }):Promise<{ [key:string]: { value: any, canEdit?:boolean, canRead?:boolean } }>{
    const result: { [key:string]: { value: any, canEdit?:boolean, canRead?:boolean } } = {};
    for (const prop of props) {
      result[prop] = await this.readProperty({ id, session, prop, nodevar });
    }
    return result;
  }

  async readProperty({
    id,
    session,
    nodevar,
    prop
  }: {
    id: string;
    session: ISession;
    nodevar: string;
    prop: string
  }): Promise<{ value: any; canEdit?: boolean; canRead?: boolean }> {

    const aclReadPropName = `canRead${upperFirst(prop)}`;
    const aclEditPropName = `canEdit${upperFirst(prop)}`;
    const aclReadNodeName = `canRead${upperFirst(nodevar)}s`;
    let content:string, type:string = nodevar;

    if (nodevar === "lang") {
      type = "language"
    } 

    if (prop === "id" || prop === "createdAt") {
      content = `
      (${nodevar}:${upperFirst(type)} { active: true, id: $id })
      return ${nodevar}.${prop} as value, ${nodevar}.${aclReadNodeName} as canRead, null as canEdit
      `
    } else {
      content = `
      (${nodevar}: ${upperFirst(type)} { active: true, id: $id })
      WITH * OPTIONAL MATCH (user)<-[:member]-(acl:ACL { ${aclReadPropName}: true })
      -[:toNode]->(${nodevar})-[:${prop} {active: true}]->(${prop}:Property {active: true})
      RETURN ${prop}.value as value, acl.${aclReadPropName} as canRead, acl.${aclEditPropName} as canEdit
      `
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
      if(nodevar === "lang") console.info("QUERY", query, prop);
      throw new NotFoundException('Could not find requested key');
    }

    return result[0] as { value: any; canEdit?: boolean; canRead?: boolean };
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
    try {
      const result = await this.db
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
          },
        )
        .run();
    } catch (e) {
      throw e;
    }
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
    try {
      for (const prop of props) {
        await this.deleteProperty({
          object,
          session,
          key: prop,
          nodevar,
        });
      }
    } catch (e) {
      throw e;
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
      aclEditProp || `canEdit${upperFirst(baseNodeLabel as string)}`;

    await this.createBaseNode<TObject>({
      session,
      baseNodeLabel,
      input,
      acls,
      aclEditProp: aclEditPropName,
    });

    const wait = [];
    Object.keys(input).map(async key => {
      if (key === 'id' || key === 'userId') {
        return;
      }
      wait.push(
        this.createProperty({
          session,
          key,
          value: input[key],
          id: input.id,
        }),
      );
    });
    await Promise.all(wait);
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
    const aclString = JSON.stringify(acls).replace(/\"/g, '');
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
      const result = await this.db
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
        (item)-[rel :${key} { active: true , createdAt: datetime()}]->
           (${key}: Property {
             active: true,
             value: "${value}"
           })
      RETURN
        ${key}.value, rel
      `;

    try {
      const result = await this.db
        .query()
        .raw(query, {
          token: session.token,
          requestingUserId: session.userId,
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
