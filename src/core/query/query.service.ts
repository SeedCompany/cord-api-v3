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

@Injectable()
export class QueryService {
  private readonly db: Connection;
  constructor(@Logger('db2:service') private readonly logger: ILogger) {
    this.db = new Connection('bolt://localhost', {
      username: 'neo4j',
      password: 'asdf',
    });
  }

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
    requestingUserId: string | undefined,
    createReaderSg = true
  ) {
    const query = this.db.query();

    const returnObj: any = {};

    let reqUser = '';

    if (requestingUserId === baseNode.id) {
      reqUser = 'baseNode';
    } else {
      reqUser = 'requestingUser';
      query.match(
        node(reqUser, 'User', {
          id: requestingUserId,
          active: true,
        })
      );
    }
    let createQuery = [];

    // base node
    const createBaseNode = [
      node('baseNode', ['BaseNode', baseNode.label], {
        id: baseNode.id,
        createdAt: baseNode.createdAt,
        active: true,
        owningOrgId: 'Seed Company',
      }),
    ];

    createQuery.push(createBaseNode);

    // properties
    const addProperty = (identifier: string, value: any, labels: string[]) => {
      if (!value) {
        return [];
      }

      const arr = [
        node('baseNode'),
        relation('out', '', identifier, {
          active: true,
          createdAt: baseNode.createdAt,
        }),
        node(identifier + '_var', labels, {
          active: true,
          value,
          createdAt: baseNode.createdAt,
        }),
      ];

      return arr;
    };

    // security groups
    const adminSgId = generate();
    createQuery.push([
      node(reqUser),
      relation('in', '', 'member', {
        active: true,
        createdAt: baseNode.createdAt,
      }),
      node('adminSG', 'SecurityGroup', {
        id: adminSgId,
        createdAt: baseNode.createdAt,
        active: true,
        name: `admin SG for ${baseNode.id}`,
      }),
    ]);

    const readerSgId = generate();
    if (createReaderSg) {
      createQuery.push([
        node(reqUser),
        relation('in', '', 'member', {
          active: true,
          createdAt: baseNode.createdAt,
        }),
        node('readerSG', 'SecurityGroup', {
          id: readerSgId,
          createdAt: baseNode.createdAt,
          active: true,
          name: `reader SG for ${baseNode.id}`,
        }),
      ]);
    }

    // permissions
    const addPermission = (
      property: string,
      sgCypherVar: string,
      read: boolean,
      edit: boolean,
      admin: boolean
    ) => {
      return [
        node(sgCypherVar),
        relation('out', '', 'permission', {
          active: true,
          createdAt: baseNode.createdAt,
        }),
        node(property + sgCypherVar + '_permission', 'Permission', {
          property,
          active: true,
          read,
          edit,
          admin,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt: baseNode.createdAt,
        }),
        node('baseNode'),
      ];
    };

    for (let i = 0; i < baseNode.props.length; i++) {
      // properties
      if (baseNode.props[i].addToAdminSg) {
        createQuery.push(
          addProperty(
            baseNode.props[i].key,
            baseNode.props[i].value,
            baseNode.props[i].labels
          )
        );
      }

      // permissions
      createQuery.push(
        addPermission(baseNode.props[i].key, 'adminSG', true, true, true)
      );

      if (createReaderSg && baseNode.props[i].addToReaderSg) {
        createQuery.push(
          addPermission(baseNode.props[i].key, 'readerSG', true, false, false)
        );
      }

      returnObj[baseNode.props[i].key + '_var'] = [
        {
          value: baseNode.props[i].key,
        },
      ];

      returnObj[baseNode.props[i].key + 'adminSG' + '_permission'] = [
        {
          read: baseNode.props[i].key + 'Read',
          edit: baseNode.props[i].key + 'Edit',
          admin: baseNode.props[i].key + 'Admin',
        },
      ];
    }

    // run query
    const result = await query
      .create(createQuery)
      .return({
        baseNode: [{ id: 'id' }],
      })
      .first();

    if (!result) {
      throw new ServerException('failed to create user');
    }

    return result.id;
  }

  async readBaseNode(
    baseNode: Partial<BaseNode>,
    requestingUserId: string | undefined
  ) {
    const query = this.db.query();

    const returnObj: any = {};

    query.match([
      node('reqUser', 'User', {
        id: requestingUserId,
      }),
    ]);
    query.optionalMatch([
      node('baseNode', 'BaseNode', {
        id: baseNode.id,
      }),
    ]);

    if (!baseNode.props) {
      throw Error('baseNode.props needed');
    }

    returnObj['baseNode'] = [{ id: 'id' }, { createdAt: 'createdAt' }];

    for (let i = 0; i < baseNode.props.length; i++) {
      const propName = baseNode.props[i].key;
      query.optionalMatch([
        node('reqUser'),
        relation('in', '', 'member', {
          active: true,
        }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', {
          active: true,
        }),
        node(propName + '_permission', 'Permission', {
          property: propName,
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('baseNode'),
        relation('out', '', propName),
        node(propName + '_var', 'Property', {
          active: true,
        }),
      ]);

      returnObj[propName + '_var'] = [
        {
          value: propName,
        },
      ];

      returnObj[propName + '_permission'] = [
        {
          read: propName + 'Read',
          edit: propName + 'Edit',
          admin: propName + 'Admin',
        },
      ];
    }

    const ready = query.return(returnObj); //

    const cypher = ready;

    const result = await cypher.first();

    return result;
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
