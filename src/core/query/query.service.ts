/* eslint-disable */
import {
  Injectable,
  InternalServerErrorException as ServerException,
  UnauthorizedException as UnauthenticatedException,
} from '@nestjs/common';
import { Connection, node, relation } from 'cypher-query-builder';
import { BaseNode } from './model';
import { ILogger, Logger } from '../logger';
import { generate } from 'shortid';
import { DateTime } from 'luxon';
const fetch = require('node-fetch');
import { gql } from 'apollo-server-core';
import {
  createPermission,
  createData,
  createDataHolder,
  createBaseNode,
  updateProperty,
  secureReadDataByBaseNodeId,
} from './queryTemplates';
import * as argon2 from 'argon2';
@Injectable()
export class QueryService {
  private readonly db: Connection;
  constructor(@Logger('db2:service') private readonly logger: ILogger) {
    this.db = new Connection('bolt://localhost', {
      username: 'neo4j',
      password: 'asdf',
    });
  }

  // GraphQL Functions

  async sendGraphql(query: {}, variables?: {}) {
    const result = await fetch('http://127.0.0.1:3000/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    return await result.json();
  }

  //////////////////////////////////////////////////////////////////

  // Constraints

  async createPropertyExistenceConstraintOnNodeAndRun(
    label: string,
    property: string
  ) {
    await this.db
      .query()
      .raw(`create constraint on (n:${label}) assert exists(n.${property})`)
      .run();
  }

  async createPropertyExistenceConstraintOnRelationshipAndRun(
    type: string,
    property: string
  ) {
    await this.db
      .query()
      .raw(
        `create constraint on ()-[n:${type}]-() assert exists(n.${property})`
      )
      .run();
  }

  async createPropertyUniquenessConstraintOnNodeAndRun(
    label: string,
    property: string
  ) {
    await this.db
      .query()
      .raw(`create constraint on (n:${label}) assert n.${property} is unique`)
      .run();
  }

  // Base Node

  async createBaseNode(
    baseNode: BaseNode,
    requestingUserId: string,
    createReaderSg = true
  ) {
    const sgAdminId = generate();
    const sgReaderId = generate();

    let propQuery = '';
    let q = 0;

    for (let i = 0; i < baseNode.props.length; i++) {
      const prop = baseNode.props[i];

      let adminPerm = '';
      let readerPerm = '';
      let dataQuery = '';

      const dhId = generate();

      let valueType = '';
      if (typeof prop.value === 'boolean') {
        valueType = 'BOOLEAN';
      } else if (typeof prop.value === 'number') {
        valueType = 'NUMBER';
      } else if (typeof prop.value === 'string') {
        valueType = 'STRING';
      } else if (prop.baseNode !== undefined) {
        valueType = 'BASENODE';
      } else {
        // throw Error('property type not recognized');
      }

      if (prop.addToAdminSg) {
        adminPerm += createPermission(
          'q' + q++,
          baseNode.createdAt,
          prop.key,
          sgAdminId,
          dhId,
          true,
          true,
          true
        );
      }

      if (prop.addToReaderSg) {
        readerPerm += createPermission(
          'q' + q++,
          baseNode.createdAt,
          prop.key,
          sgReaderId,
          dhId,
          true,
          false,
          false
        );
      }

      if (prop.baseNode === undefined) {
        dataQuery += createData(
          'q' + q++,
          baseNode.createdAt,
          prop.value,
          dhId,
          prop.labels
        );
      }

      propQuery += createDataHolder(
        'q' + q++,
        dhId,
        baseNode.createdAt,
        prop.key,
        valueType,
        prop.isSingleton,
        baseNode.id,
        dataQuery,
        adminPerm,
        readerPerm
      );
    } // end prop loop

    const query = createBaseNode(
      `q` + q++,
      baseNode.id,
      baseNode.createdAt,
      baseNode.label,
      sgAdminId,
      requestingUserId,
      sgReaderId,
      propQuery
    );

    // this.logger.info(query);

    const result = await this.sendGraphql(query);
    if (!result) {
      throw new ServerException('failed to create user');
    }

    // this.logger.info(JSON.stringify(result));

    return baseNode.id;
  }

  async readBaseNode(baseNode: BaseNode, requestingUserId?: string) {
    if (baseNode.id === undefined || baseNode.id === null) {
      return;
    }
    if (requestingUserId === undefined) {
      return;
    }

    let propsQuery = ``;
    let q = 0;

    if (!baseNode.props) {
      return;
    }

    for (let i = 0; i < baseNode.props.length; i++) {
      const prop = baseNode.props[i];

      if (prop.key === undefined) {
        continue;
      }

      propsQuery += secureReadDataByBaseNodeId(
        baseNode.id,
        requestingUserId,
        prop.key,
        prop.isSingleton
      );
    }

    let query = `
      query{
        baseNode: BaseNode(id:"${baseNode.id}"){
          createdAt{formatted}
        }

        ${propsQuery}
      }
    `;

    const result = await this.sendGraphql(query);

    result.data['id'] = baseNode.id;
    result.data['createdAt'] = result.data.baseNode[0].createdAt.formatted;

    return result.data;
  }

  async updateBaseNode(baseNode: BaseNode, requestingUserId: string) {
    // if prop is array and includes old value, set old value to false and create new prop
    // if prop is array and is missing old value, create new prop
    // if prop isn't array, optional match on old value and set to inactive, create new prop

    if (baseNode.id === undefined || baseNode.id === null) {
      return;
    }
    if (requestingUserId === undefined) {
      return;
    }
    if (!baseNode.props) {
      return;
    }

    let updates = '';
    let q = 0;

    for (let i = 0; i < baseNode.props.length; i++) {
      const data = baseNode.props[i];

      if (!baseNode.props[i].value) {
        continue;
      }

      updates += updateProperty(
        `${q++}`,
        baseNode.id,
        requestingUserId,
        data.key,
        data.value,
        data.oldValue,
        data.isSingleton,
        data.labels
      );
    }

    const query = `
      mutation{
        ${updates}
      }
    `;

    const result = await this.sendGraphql(query);

    if (!result) {
      throw new ServerException('failed to update base node');
    }

    return result.id;
  }

  // Property Values

  async confirmPropertyValueExists(labels: string[], expectedValue: any) {
    const result = await this.db
      .query()
      .match([
        node('data', 'Data', {
          active: true,
          value: expectedValue,
        }),
      ])
      .return({ data: [{ value: 'value' }] })
      .first();

    if (result) {
      if (result.value === expectedValue) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  // Authentication

  async createToken(token: string, createdAt: DateTime) {
    const tokenId = generate();
    const result = await this.db
      .query()
      .create([
        node('token', ['Token', 'Data'], {
          active: true,
          createdAt: createdAt.toNeo4JDateTime(),
          value: token,
          id: tokenId,
        }),
      ])
      .return({
        token: [{ value: 'token' }],
      })
      .first();

    if (!result) {
      throw Error('failed to create token');
    }

    return result.token;
  }

  async createSession(token: string) {
    const result = await this.db
      .query()
      .match([
        node('token', 'Token', {
          active: true,
          value: token,
        }),
      ])
      .optionalMatch([
        node('token'),
        relation('in', '', 'DATA'),
        node('dh', 'DataHolder', {
          active: true,
          identifier: 'token',
        }),
        relation('in', '', 'DATAHOLDERS'),
        node('user', 'User', {
          active: true,
        }),
      ])
      .return({
        token: [{ value: 'token' }],
        user: [{ id: 'userId' }],
      })
      .first();

    return result;
  }

  async login(token: string, email: string, password: string) {
    try {
      // get the pash
      const result1 = await this.db
        .query()
        .raw(
          `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
      MATCH
        (:Email {active: true, value: $email})
        <-[:DATA]-
        (:DataHolder {
          active: true,
          identifier: "email"
        })
        <-[:DATAHOLDERS]-
        (user:User {
          active: true
        })
        -[:DATAHOLDERS]->
        (:DataHolder {
          active: true,
          identifier: "password"
        })
        -[:DATA]->
        (password:Data {
          active: true
        })
      RETURN
        password.value as pash, 
        user.id as userId
        
      `,
          {
            token: token,
            email: email,
          }
        )
        .first();

      if (!result1 || !(await argon2.verify(result1.pash, password))) {
        throw new UnauthenticatedException('Invalid credentials');
      }

      // create rel to show logged in
      const result2 = await this.db
        .query()
        .raw(
          `
          MATCH
            (token:Token {
              active: true,
              value: $token
            })
          MATCH
            (user:User {
              id: $userId
            })
            -[:DATAHOLDERS]->
            (tokenHolder:DataHolder{
              active: true,
              identifier: "token"
            })
          OPTIONAL MATCH
            (token)-[r]-()
          DELETE r
          CREATE
            (tokenHolder)
            -[:DATA]->
            (token)
          RETURN
            tokenHolder.id as id
        `,
          {
            token: token,
            email: email,
            userId: result1.userId,
          }
        )
        .first();

      if (!result2 || !result1.userId) {
        throw new ServerException('Login failed');
      }

      return result1.userId;
    } catch (e) {
      console.error(e);
    }
    return '';
  }
}
