/* eslint-disable */
import {
  Injectable,
  InternalServerErrorException as ServerException,
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
} from './queryTemplates';
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
        adminPerm = createPermission(
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
        adminPerm = createPermission(
          'q' + q++,
          baseNode.createdAt,
          prop.key,
          sgAdminId,
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

    // console.log(query);
    const result = await this.sendGraphql(query);
    if (!result) {
      throw new ServerException('failed to create user');
    }

    console.log(result);

    return result;
  }

  async gqlReadBaseNode(
    baseNode: Partial<BaseNode>,
    requestingUserId: string | undefined
  ) {
    if (requestingUserId === undefined) {
      console.log('no requesting user id');
      return;
    }

    let propsQuery = '';
    let q = 0;

    if (!baseNode.props) {
      return;
    }

    for (let i = 0; i < baseNode.props.length; i++) {
      const prop = baseNode.props[i];

      if (prop.key === undefined) {
        continue;
      }

      propsQuery += `
        q${q++}: secureReadDataByBaseNodeId(
          baseNodeId: "${baseNode.id}"
          requestingUserId: "${requestingUserId}"
          identifier: "${prop.key}"
        ){
          value
        }
      `;
    }

    let query = `
      mutation{
        ${propsQuery}
      }
    `;

    console.log(query);
    const result = await this.sendGraphql(query);

    console.log(JSON.stringify(result));

    for (let i = 0; i < q; i++) {
      console.log(result.data['q' + i]);
    }

    return baseNode.id;
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

  async readBaseNode(
    baseNode: Partial<BaseNode>,
    requestingUserId: string | undefined
  ) {
    const result2 = await this.gqlReadBaseNode(baseNode, requestingUserId);

    const query = this.db.query();

    let returnString = '';

    // const returnObj: any = {};

    if (requestingUserId) {
      query.match([
        node('reqUser', 'User', {
          id: requestingUserId,
        }),
      ]);

      query.match([
        node('baseNode', 'BaseNode', {
          id: baseNode.id,
        }),
      ]);

      if (!baseNode.props) {
        throw Error('baseNode.props needed');
      }

      /*
    we'll use an array to hold the 3 different permission types. 
    in the property for loop we'll loop through the 3 permission types
    to find, definitively, if the user has that permission through ANY security group.
    It is possible that the user has a large amount of security group and that only one
    may give an admin = true, so we must ensure that each permission is 
    searched for by itself.
    */
      const perms = ['Read', 'Edit', 'Admin'];

      for (let i = 0; i < baseNode.props.length; i++) {
        const propName = baseNode.props[i].key;

        for (let j = 0; j < perms.length; j++) {
          query.optionalMatch([
            node('reqUser'),
            relation('in', '', 'member', {
              active: true,
            }),
            node('sg', 'SecurityGroup', { active: true }),
            relation('out', '', 'permission', {
              active: true,
            }),
            node(
              propName + '_permission_' + perms[j].toLowerCase(),
              'Permission',
              {
                property: propName,
                [perms[j].toLowerCase()]: true,
                active: true,
              }
            ),
            relation('out', '', 'baseNode', { active: true }),
            node('baseNode'),
            relation('out', '', propName, {
              active: true,
            }),
            node(propName + '_var', baseNode.props[i].labels, {
              active: true,
            }),
          ]);

          if (j === 0) {
            // not sure yet how to wrap return clauses in functions using query builder
            returnString += `collect(${propName}_var.value)[0] as ${propName}, `;
            // returnObj[propName + '_var'] = [
            //   {
            //     value: propName,
            //   },
            // ];
          }

          returnString += `collect(${propName}_permission_${perms[
            j
          ].toLowerCase()}.${perms[j].toLowerCase()})[0] as ${propName}${
            perms[j]
          },`;

          // if (i + 1 < baseNode.props.length && j <= 1) {
          //   returnString += ',';
          // }

          // returnObj[propName + '_permission_' + perms[j].toLowerCase()] = [
          //   {
          //     [perms[j].toLowerCase()]: propName + perms[j],
          //   },
          // ];
        }
      }

      returnString += `baseNode.id as id, baseNode.createdAt as createdAt`;
      // returnObj['baseNode'] = [{ id: 'id' }, { createdAt: 'createdAt' }];

      const cypher = query.return(returnString);
      // console.log(cypher.interpolate());
      return await query.first();
    } else {
      // todo: retrieve public or org viewable data
      console.log('todo: public/org data');
      return;
    }
  }

  async updateBaseNode(baseNode: BaseNode, requestingUserId: string) {
    // if prop is array and includes old value, set old value to false and create new prop
    // if prop is array and is missing old value, create new prop
    // if prop isn't array, optional match on old value and set to inactive, create new prop

    const query = this.db
      .query()

      .match([
        node('reqUser', 'User', {
          active: true,
          id: requestingUserId,
        }),
      ])
      .match([
        node('baseNode', 'BaseNode', {
          active: true,
          id: baseNode.id,
        }),
      ]);

    for (let i = 0; i < baseNode.props.length; i++) {
      const propName = baseNode.props[i].key;

      if (!baseNode.props[i].value) {
        continue;
      }

      query.with('*');
      // the property may or may not exist, first get to the base node with edit permission
      query.match([
        node('reqUser'),
        relation('in', '', 'member', {
          active: true,
        }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('', 'Permission', {
          property: propName,
          edit: true,
          active: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
        }),
        node('baseNode'),
      ]);

      if (baseNode.props[i].isSingleton === true) {
        if (baseNode.props[i].oldValue) {
          // we are replacing an old value, not creating a new one
          query

            .optionalMatch([
              node('baseNode'),
              relation('out', propName + '_rel', propName, {
                active: true,
              }),
              node(propName, baseNode.props[i].labels, {
                active: true,
                value: baseNode.props[i].oldValue,
              }),
            ])
            .setValues(
              {
                [propName + '_rel']: { active: false },
                [propName]: { active: false },
              },
              true
            );
        }
      } else if (baseNode.props[i].isSingleton === false) {
        // property is a singleton, it doesn't matter if it exists or not
        query

          .optionalMatch([
            node('baseNode'),
            relation('out', propName + '_rel', propName, {
              active: true,
            }),
            node(propName, baseNode.props[i].labels, {
              active: true,
            }),
          ])
          .setValues(
            {
              [propName + '_rel']: { active: false },
              [propName]: { active: false },
            },
            true
          );
      }

      // create new property
      query.create([
        node('baseNode'),
        relation('out', '', propName, {
          active: true,
          createdAt: baseNode.createdAt,
        }),
        node(propName + '_new', baseNode.props[i].labels, {
          active: true,
          value: baseNode.props[i].value,
          createdAt: baseNode.createdAt,
        }),
      ]);
    }

    query.return({
      baseNode: [{ id: 'id' }],
    });

    const result = await query.first();

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
        node('prop', 'Property', {
          active: true,
          value: expectedValue,
        }),
      ])
      .return({ prop: [{ value: 'value' }] })
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
    const result = await this.db
      .query()
      .create([
        node('token', ['Token', 'Property'], {
          active: true,
          createdAt: createdAt.toNeo4JDateTime(),
          value: token,
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
        relation('in', '', 'token', {
          active: true,
        }),
        node('user', 'User', {
          active: true,
        }),
      ])
      .return({
        token: [{ value: 'token' }],
        user: [{ owningOrgId: 'owningOrgId' }, { id: 'userId' }],
      })
      .first();

    return result;
  }

  async login(token: string, email: string, password: string) {
    const result1 = await this.db.query().match([]).first();
  }
}
