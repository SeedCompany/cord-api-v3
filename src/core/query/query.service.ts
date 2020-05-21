/* eslint-disable */
import {
  Injectable,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { Connection, node, relation } from 'cypher-query-builder';
import { BaseNode } from './model';
import { ILogger, Logger } from '../logger';
import { generate } from 'shortid';

@Injectable()
export class QueryService {
  private readonly db: Connection;
  constructor(@Logger('db2:service') private readonly logger: ILogger) {
    this.db = new Connection('bolt://localhost', {
      username: 'neo4j',
      password: 'asdf',
    });
  }

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

  async createBaseNode(
    baseNode: BaseNode,
    requestingUserId: string | undefined,
    createReaderSg = true
  ) {
    const query = this.db.query();

    let reqUser = '';

    if (requestingUserId === baseNode.id) {
      reqUser = 'baseNode';
    } else {
      reqUser = 'requestingUser';
      query.match(
        node(reqUser, 'User', {
          id: requestingUserId,
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
    const addProperty = (
      identifier: string,
      value: any,
      label: string = ''
    ) => {
      if (!value) {
        return [];
      }

      const arr = [
        node('baseNode'),
        relation('out', '', identifier, {
          active: true,
          createdAt: baseNode.createdAt,
        }),
      ];

      if (label === '') {
        arr.push(
          node(identifier, 'Property', {
            active: true,
            value,
            createdAt: baseNode.createdAt,
          })
        );
      } else {
        arr.push(
          node(identifier, ['Property', label], {
            active: true,
            value,
            createdAt: baseNode.createdAt,
          })
        );
      }

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
        node('', 'Permission', {
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
            baseNode.props[i].label
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
    }

    // run query
    const result = await query
      .create(createQuery)
      .return({ baseNode: [{ id: 'id' }] })
      .first();

    if (!result) {
      throw new ServerException('failed to create user');
    }

    return baseNode.id;
  }
}
