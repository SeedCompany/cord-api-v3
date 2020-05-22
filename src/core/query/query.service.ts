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

    // const returnObj: any = {};

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

      // returnObj[baseNode.props[i].key + '_var'] = [
      //   {
      //     value: baseNode.props[i].key,
      //   },
      // ];

      // returnObj[baseNode.props[i].key + 'adminSG' + '_permission'] = [
      //   {
      //     read: baseNode.props[i].key + 'Read',
      //     edit: baseNode.props[i].key + 'Edit',
      //     admin: baseNode.props[i].key + 'Admin',
      //   },
      // ];
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
      console.log(cypher.interpolate());
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

    const query = this.db.query();

    //   .match([
    //     node('reqUser', 'User', {
    //       active: true,
    //       id: requestingUserId,
    //     }),
    //   ])
    //   .match([
    //     node('baseNode', 'BaseNode', {
    //       active: true,
    //       id: baseNode.id,
    //     }),
    //   ]);

    for (let i = 0; i < baseNode.props.length; i++) {
      const propName = baseNode.props[i].key;

      // the property may or may not exist, first get to the base node with edit permission
      query.match([
        node('reqUser', 'User', {
          active: true,
          id: requestingUserId,
        }),
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
        relation('out', propName + '_rel', 'baseNode', {
          active: true,
        }),
        node('baseNode', 'BaseNode', {
          active: true,
          id: baseNode.id,
        }),
      ]);

      if (baseNode.props[i].isPropertyArray === true) {
        if (baseNode.props[i].oldValue) {
          // we are replacing an old value, not creating a new one
          query
            .with('*')
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
            .setValues({
              [propName + '_rel']: { active: false },
              [propName]: { active: false },
            });
        }
      } else if (baseNode.props[i].isPropertyArray === false) {
        // property is a singleton, it doesn't matter if it exists or not
        query
          .with('*')
          .optionalMatch([
            node('baseNode'),
            relation('out', propName + '_rel', propName, {
              active: true,
            }),
            node(propName, baseNode.props[i].labels, {
              active: true,
            }),
          ])
          .setValues({
            [propName + '_rel']: { active: false },
            [propName]: { active: false },
          });
      }

      // create new property
      query.with('*');
      query.create([
        node('baseNode'),
        relation('out', '', propName, {
          active: true,
        }),
        node(propName + '_new', baseNode.props[i].labels, {
          active: true,
          value: baseNode.props[i].value,
          createdAt: baseNode.createdAt,
        }),
      ]);
    }

    // if (baseNode.props[i].isPropertyArray === true) {
    //   // set current value to active = false
    //   query
    //     .match([
    //       node('reqUser', 'User', {
    //         id: requestingUserId,
    //       }),
    //       relation('in', '', 'member', {
    //         active: true,
    //       }),
    //       node('', 'SecurityGroup', { active: true }),
    //       relation('out', '', 'permission', {
    //         active: true,
    //       }),
    //       node('', 'Permission', {
    //         property: propName,
    //         edit: true,
    //         active: true,
    //       }),
    //       relation('out', propName + '_rel', 'baseNode', {
    //         active: true,
    //       }),
    //       node('baseNode', 'BaseNode', {
    //         active: true,
    //         id: baseNode.id,
    //       }),
    //     ])
    // } else if (baseNode.props[i].isPropertyArray === false) {
    //   // find old value and set to active = false
    //   query
    //     .match([
    //       node('reqUser', 'User', {
    //         id: requestingUserId,
    //       }),
    //       relation('in', '', 'member', {
    //         active: true,
    //       }),
    //       node('', 'SecurityGroup', { active: true }),
    //       relation('out', '', 'permission', {
    //         active: true,
    //       }),
    //       node('', 'Permission', {
    //         property: propName,
    //         edit: true,
    //         active: true,
    //       }),
    //       relation('out', propName + '_rel', 'baseNode', {
    //         active: true,
    //       }),
    //       node('baseNode', 'BaseNode', {
    //         active: true,
    //         id: baseNode.id,
    //       }),
    //       relation('out', '', propName, {
    //         active: true,
    //       }),
    //       node(propName, baseNode.props[i].labels, {
    //         active: true,
    //         value: baseNode.props[i].oldValue, // <---- here's the different line
    //       }),
    //     ])
    //     .setValues({
    //       [propName + '_rel']: { active: false },
    //     });
    // }
    // query.create([
    //   node('baseNode'),
    //   relation('out', '', propName, {
    //     active: true,
    //   }),
    //   node(propName + '_new', baseNode.props[i].labels, {
    //     active: true,
    //     value: baseNode.props[i].value,
    //     createdAt: baseNode.createdAt,
    //   }),
    // ]);

    query.return({
      baseNode: [{ id: 'id' }],
    });

    const cypher = query;
    console.log(cypher.interpolate());

    // const result = await query.first();

    // if (!result) {
    //   throw new ServerException('failed to update base node');
    // }

    // return result.id;
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
