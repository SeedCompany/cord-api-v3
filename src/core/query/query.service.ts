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
  secureDeleteData,
  secureDeleteBaseNode,
} from './queryTemplates';
import * as argon2 from 'argon2';
import { POWERS } from './model/powers';
import { OnIndex } from '../database/indexer';
import { createIndexedAccessTypeNode } from 'typescript';
import { searchProperty } from './cypher.template';
@Injectable()
export class QueryService {
  private readonly db: Connection;
  constructor(@Logger('db2:service') private readonly logger: ILogger) {
    this.db = new Connection('bolt://localhost', {
      username: 'neo4j',
      password: 'asdf',
    });
  }

  // constraints on abstract nodes
  @OnIndex()
  async createIndexedAccessTypeNode() {
    await this.createPropertyExistenceConstraintOnNodeAndRun(
      'BaseNode',
      'active'
    );
    await this.createPropertyExistenceConstraintOnNodeAndRun(
      'BaseNode',
      'createdAt'
    );

    await this.createPropertyExistenceConstraintOnNodeAndRun(
      'Property',
      'active'
    );
    await this.createPropertyExistenceConstraintOnNodeAndRun(
      'Property',
      'value'
    );
    await this.createPropertyUniquenessConstraintOnNodeAndRun('BaseNode', 'id');
    await this.createPropertyUniquenessConstraintOnNodeAndRun(
      'DataHolder',
      'id'
    );
    await this.createPropertyUniquenessConstraintOnNodeAndRun('Data', 'id');
    await this.createPropertyUniquenessConstraintOnNodeAndRun(
      'SecurityGroup',
      'id'
    );
    await this.createPropertyUniquenessConstraintOnNodeAndRun(
      'Permission',
      'id'
    );
    await this.createPropertyUniquenessConstraintOnNodeAndRun('Power', 'id');
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

  // Constraints //////////////////////////////////////////////////////////////

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

  // Base Node CRUD

  async createBaseNode(
    baseNode: BaseNode,
    requestingUserId: string,
    createReaderSG = true
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
        baseNode.label,
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

    // this.logger.info(query);

    const result = await this.sendGraphql(query);

    if (result) {
      // this.logger.info('baseNodeId ' + baseNode.id);
      result.data['id'] = baseNode.id;
      result.data['createdAt'] = result.data.baseNode[0].createdAt.formatted;
      delete result.data['baseNode'];
      // this.logger.info(JSON.stringify(result));
    } else {
      throw Error('No data');
    }

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

  async deleteBaseNode(
    baseNodeId: string,
    requestingUserId: string,
    baseNodeLabel: string,
    power: POWERS
  ) {
    const deleteQuery = secureDeleteBaseNode(
      'd',
      baseNodeId,
      requestingUserId,
      baseNodeLabel,
      power
    );

    const query = `
        mutation{
          ${deleteQuery}
        }
      `;

    const result = this.sendGraphql(query);

    if (result) {
      return true;
    } else {
      return false;
    }
  }

  // Base Node Search

  async listBaseNode(
    baseNode: BaseNode,
    requestingUserId: string | undefined,
    page: number,
    count: number,
    sort: string,
    order: string,
    filter: string
  ) {
    let query = this.db.query();

    let propsQuery = '';
    let returnQuery = '';
    let orderByQuery = '';

    for (let i = 0; i < baseNode.props.length; i++) {
      const prop = baseNode.props[i];
      const propNodeKey = `${prop.key}_node`;
      propsQuery += searchProperty(baseNode.label, prop.key, propNodeKey);

      if (prop.orderBy) {
        if (prop.asc) {
          orderByQuery = `${propNodeKey}.value ASC`;
        } else {
          orderByQuery = `${propNodeKey}.value DESC`;
        }
      }

      returnQuery += `{${prop.key}: {value: ${propNodeKey}.value}} as node`;
    }

    query.raw(`
    MATCH (requestingUser:User {id: "${requestingUserId}"})
    ${propsQuery}
    RETURN
    ${returnQuery}
    ORDER BY ${orderByQuery}
    SKIP ${page * count - count}
    LIMIT ${count}
    `);

    const printMe = query;

    this.logger.info(printMe.interpolate());

    const itemsQuery: any = await query.run();

    let items = [];

    for (let i = 0; i < itemsQuery.length; i++) {
      items.push(itemsQuery[i].node);
    }

    this.logger.info(JSON.stringify(items));

    // todo: count(baseNodes) as total
    // const countQuery: any = await this.db
    //   .query()
    //   .raw(
    //     `
    //     MATCH (requestingUser:User {id: "${requestingUserId}})

    //     RETURN count(requestingUser) as total
    //     `
    //   )
    //   .first();

    if (itemsQuery) {
      return {
        items,
        total: 5,
        hasMore: true,
      };
    } else {
      return undefined;
    }
  }

  // Properties

  async confirmPropertyValueExists(
    labels: string[],
    expectedValue: any
  ): Promise<boolean> {
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

  async deletePropertiesOnBaseNode(
    baseNode: BaseNode,
    requestingUserId: string
  ) {
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

    let deletes = '';
    let q = 0;

    for (let i = 0; i < baseNode.props.length; i++) {
      const data = baseNode.props[i];

      if (!baseNode.props[i].value) {
        continue;
      }

      deletes += secureDeleteData(
        `q${q++}`,
        baseNode.id,
        requestingUserId,
        data.key,
        data.value
      );
    }

    const query = `
      mutation{
        ${deletes}
      }
    `;

    const result = await this.sendGraphql(query);

    if (!result) {
      throw new ServerException('failed to update base node');
    }

    return result.id;
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

  async logout(token: string) {
    await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token{ value: $token})-[r]-()
        DELETE
          r
        RETURN
          token.value as token
      `,
        {
          token,
        }
      )
      .run();
  }

  async mergeRootAdminUserAndSecurityGroup(email: string, password: string) {
    // merge on the root sg label, which will create a node if it doesn't exist
    let sgId = generate();
    const sgMergeResult = await this.db
      .query()
      .merge(node('sg', ['RootSecurityGroup', 'SecurityGroup']))
      .onCreate.setValues({
        'sg.id': sgId,
        'sg.active': true,
      })
      .setVariables({
        'sg.createdAt': 'datetime()',
      })
      .return({ sg: [{ id: 'sgId' }] })
      .first();

    if (sgMergeResult) {
      sgId = sgMergeResult.sgId;
    } else {
      throw Error('failed to create root security group');
    }

    // check to see if user exists
    let userId = generate();
    const findUserResult = await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'DATAHOLDERS'),
        node('dh', 'DataHolder', {
          active: true,
          identifier: 'email',
        }),
        relation('out', '', 'DATA'),
        node('email', 'Email', {
          active: true,
          value: email,
        }),
      ])

      .return({ user: [{ id: 'userId' }] })
      .first();

    if (findUserResult) {
      userId = findUserResult.userId;
    } else {
      // current root user doesn't exist yet, create it
      const pash = await argon2.hash(password);
      const createdAt = DateTime.local();

      const createUserResult = await this.createBaseNode(
        {
          label: 'User',
          id: userId,
          createdAt: createdAt.toString(),
          props: [
            {
              key: 'token',
              value: '',
              isSingleton: false,
              labels: ['Token'],
              addToAdminSg: true,
              addToReaderSg: false,
            },
            {
              key: 'email',
              value: email,
              isSingleton: true,
              labels: ['Email'],
              addToAdminSg: true,
              addToReaderSg: false,
            },
            {
              key: 'password',
              value: pash,
              isSingleton: true,
              addToAdminSg: true,
              addToReaderSg: false,
            },
          ],
        },
        userId, // the user being created is the 'requesting user'
        false
      );

      if (!createUserResult) {
        throw Error('failed creating root user');
      }
    }

    // this.logger.info(`root user id: ${userId}`);

    // ensure the user and sg are connected
    const mergeUserAndSGResult = await this.db
      .query()
      .match([
        node('sg', 'RootSecurityGroup', {
          id: sgId,
        }),
      ])
      .match([
        node('user', 'User', {
          id: userId,
        }),
      ])
      .setValues({
        'sg.active': true,
        'user.active': true,
      })
      .merge([node('sg'), relation('out', '', 'MEMBERS'), node('user')])
      .return({ user: [{ id: 'userId' }] })
      .first();

    if (!mergeUserAndSGResult) {
      throw Error('failed to connect root user and root security group');
    }

    // ensure security group has all the latest powers
    for (let power in POWERS) {
      const powerId = generate();
      const matchPowerResult = await this.db
        .query()
        .merge(
          node('power', 'Power', {
            value: power,
          })
        )
        .onCreate.setValues({
          'power.id': powerId,
          'power.active': true,
        })
        .setVariables({
          'power.createdAt': 'datetime()',
        })
        .with('*')
        .match(
          node('sg', 'RootSecurityGroup', {
            active: true,
            id: sgId,
          })
        )
        .merge([node('sg'), relation('out', '', 'POWERS'), node('power')])
        .return({ power: [{ id: 'id' }] })
        .first();

      if (!matchPowerResult) {
        throw Error('Failed to merge power');
      }
    }
  }

  // Authorization

  async userCanCreateBaseNode(userId: string, power: POWERS): Promise<boolean> {
    const result = await this.db
      .raw(
        `
    MATCH 
      (user:User {
        active: true,
        id: $userId
      })
      <-[:MEMBERS]-
      (sg:SecurityGroup{
        active: true
      })
      -[:POWERS]->
      (power:Power {
        active: true
        value: $power
      })
      RETURN user.id as id
    `,
        {
          userId,
          power,
        }
      )
      .first();

    if (result) {
      if (result.id === userId) {
        return true;
      }
    }

    return false;
  }
}
