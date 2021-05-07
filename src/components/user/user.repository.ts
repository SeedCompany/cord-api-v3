import { Injectable } from '@nestjs/common';
import { node, relation, inArray } from 'cypher-query-builder';
import { Dictionary, difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  deleteProperties,
  ILogger,
  Logger,
  OnIndex,
  property,
  UniquenessError,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { QueryWithResult } from '../../core/database/query.overrides';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Role } from '../authorization';

import { Powers } from '../authorization/dto/powers';
import {
  CreatePerson,
  UpdateUser,
  User,
  UserListInput,
  UserListOutput,
} from './dto';

@Injectable()
export class UserRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}
  @OnIndex()
  async createIndexes() {
    // language=Cypher (for webstorm)
    return [
      // USER NODE
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:User) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.createdAt)',
      // EMAIL REL
      'CREATE CONSTRAINT ON ()-[r:email]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:email]-() ASSERT EXISTS(r.createdAt)',
      // EMAIL NODE
      'CREATE CONSTRAINT ON (n:EmailAddress) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:EmailAddress) ASSERT n.value IS UNIQUE',
      // PASSWORD REL
      'CREATE CONSTRAINT ON ()-[r:password]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:password]-() ASSERT EXISTS(r.createdAt)',
    ];
  }
  roleProperties = (roles?: Role[]) => {
    return (roles || []).flatMap((role) =>
      property('roles', role, 'user', `role${role}`)
    );
  };
  async create(id: string, input: CreatePerson): Promise<Dictionary<any>> {
    const createdAt = DateTime.local();
    const query = this.db.query();
    query.create([
      [
        node('user', ['User', 'BaseNode'], {
          id,
          createdAt,
        }),
      ],
      ...property('email', input.email, 'user', 'email', 'EmailAddress'),
      ...property('realFirstName', input.realFirstName, 'user'),
      ...property('realLastName', input.realLastName, 'user'),
      ...property('displayFirstName', input.displayFirstName, 'user'),
      ...property('displayLastName', input.displayLastName, 'user'),
      ...property('phone', input.phone, 'user'),
      ...property('timezone', input.timezone, 'user'),
      ...property('about', input.about, 'user'),
      ...property('status', input.status, 'user'),
      ...this.roleProperties(input.roles),
      ...property('title', input.title, 'user'),
      ...property('canDelete', true, 'user'),
    ]);
    query.return({
      user: [{ id: 'id' }],
    });
    let result;
    try {
      result = await query.first();
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'EmailAddress') {
        throw new DuplicateException(
          'person.email',
          'Email address is already in use',
          e
        );
      }
      throw new ServerException('Failed to create user', e);
    }
    if (!result) {
      throw new ServerException('Failed to create user');
    }
    // attach user to publicSG
    const attachUserToPublicSg = await this.db
      .query()
      .match(node('user', 'User', { id }))
      .match(node('publicSg', 'PublicSecurityGroup'))
      .create([node('publicSg'), relation('out', '', 'member'), node('user')])
      .create([
        node('publicSg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: 'displayFirstName',
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('user'),
      ])
      .create([
        node('publicSg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: 'displayLastName',
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('user'),
      ])
      .return('user')
      .first();
    if (!attachUserToPublicSg) {
      this.logger.error('failed to attach user to public securityGroup');
    }
    if (this.config.defaultOrg.id) {
      const attachToOrgPublicSg = await this.db
        .query()
        .match(node('user', 'User', { id }))
        .match([
          node('orgPublicSg', 'OrgPublicSecurityGroup'),
          relation('out', '', 'organization'),
          node('defaultOrg', 'Organization', {
            id: this.config.defaultOrg.id,
          }),
        ])
        .create([
          node('user'),
          relation('in', '', 'member'),
          node('orgPublicSg'),
        ])
        .run();
      if (attachToOrgPublicSg) {
        //
      }
    }
    return result;
  }
  async readOne(
    id: ID,
    sessionOrUserId: Session | ID
  ): Promise<any> {
    const query = this.db
      .query()
      .match([node('node', 'User', { id })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<User>>>();
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }
    const canDelete = await this.db.checkDeletePermission(id, sessionOrUserId);

    return {
      result,
      canDelete,
    };
  }

  getActualChanges(input: UpdateUser, user: User): any {
    //shouldn't there be an await here?
    return this.db.getActualChanges(User, user, input);
  }

  async updateProperties(
    user: User,
    simpleChanges: object
    // fieldToUpdate: string
  ): Promise<void> {
    await this.db.updateProperties({
      type: User,
      object: user,
      changes: simpleChanges,
    });
    // if (fieldToUpdate === 'email') {
    //   await this.db
    //     .query()
    //     .match([node('node', ['User', 'BaseNode'], { id: user.id })])
    //     .apply(deleteProperties(User, 'email'))
    //     .return('*')
    //     .run();

    // }
  }

  async updateEmail(
    user: User,
    email: any,
    createdAt: DateTime
  ): Promise<void> {
    //Remove old emails and relations
    await this.db
      .query()
      .match([node('node', ['User', 'BaseNode'], { id: user.id })])
      .apply(deleteProperties(User, 'email'))
      .return('*')
      .run();

    //Update email
    await this.db
      .query()
      .match([node('user', ['User', 'BaseNode'], { id: user.id })])
      .create([
        node('user'),
        relation('out', '', 'email', {
          active: true,
          createdAt,
        }),
        node('email', 'EmailAddress:Property', {
          value: email,
          createdAt,
        }),
      ])
      .run();
  }

  async updateRoles(
    input: UpdateUser,
    removals: Role[],
    additions: Role[]
  ): Promise<void> {
    if (removals.length > 0) {
      await this.db
        .query()
        .match([
          node('user', ['User', 'BaseNode'], {
            id: input.id,
          }),
          relation('out', 'oldRoleRel', 'roles', { active: true }),
          node('oldRoles', 'Property'),
        ])
        .where({
          oldRoles: {
            value: inArray(removals),
          },
        })
        .set({
          values: {
            'oldRoleRel.active': false,
          },
        })
        .run();
    }

    if (additions.length > 0) {
      await this.db
        .query()
        .match([
          node('user', ['User', 'BaseNode'], {
            id: input.id,
          }),
        ])
        .create([...this.roleProperties(additions)])
        .run();
    }
  }

  //   async update(input: UpdateUser, user: User, session: Session): Promise<any> {
  //     const changes = this.db.getActualChanges(User, user, input);
  //     if (user.id !== session.userId) {
  //       await this.authorizationService.verifyCanEditChanges(User, user, changes);
  //     }

  //     const { roles, email, ...simpleChanges } = changes;
  //     if (roles) {
  //       await this.authorizationService.checkPower(Powers.GrantRole, session);
  //     }

  //     await this.db.updateProperties({
  //       type: User,
  //       object: user,
  //       changes: simpleChanges,
  //     });
  //     // Update email
  //     if (email) {
  //       // Remove old emails and relations
  //       await this.db
  //         .query()
  //         .match([node('node', ['User', 'BaseNode'], { id: user.id })])
  //         .apply(deleteProperties(User, 'email'))
  //         .return('*')
  //         .run();

  //       try {
  //         const createdAt = DateTime.local();
  //         await this.db
  //           .query()
  //           .match([node('user', ['User', 'BaseNode'], { id: user.id })])
  //           .create([
  //             node('user'),
  //             relation('out', '', 'email', {
  //               active: true,
  //               createdAt,
  //             }),
  //             node('email', 'EmailAddress:Property', {
  //               value: email,
  //               createdAt,
  //             }),
  //           ])
  //           .run();
  //       } catch (e) {
  //         if (e instanceof UniquenessError && e.label === 'EmailAddress') {
  //           throw new DuplicateException(
  //             'person.email',
  //             'Email address is already in use',
  //             e
  //           );
  //         }
  //         throw new ServerException('Failed to create user', e);
  //       }
  //     }
  //     // Update roles
  //     if (roles) {
  //       const removals = difference(user.roles.value, roles);
  //       const additions = difference(roles, user.roles.value);
  //       if (removals.length > 0) {
  //         await this.db
  //           .query()
  //           .match([
  //             node('user', ['User', 'BaseNode'], {
  //               id: input.id,
  //             }),
  //             relation('out', 'oldRoleRel', 'roles', { active: true }),
  //             node('oldRoles', 'Property'),
  //           ])
  //           .where({
  //             oldRoles: {
  //               value: inArray(removals),
  //             },
  //           })
  //           .set({
  //             values: {
  //               'oldRoleRel.active': false,
  //             },
  //           })
  //           .run();
  //       }

  //       if (additions.length > 0) {
  //         await this.db
  //           .query()
  //           .match([
  //             node('user', ['User', 'BaseNode'], {
  //               id: input.id,
  //             }),
  //           ])
  //           .create([...this.roleProperties(additions)])
  //           .run();
  //       }

  //       await this.authorizationService.roleAddedToUser(input.id, roles);
  //       return 0;
  //     }
  //   }
  async delete(id: ID, session: Session, object: User): Promise<void> {
    const canDelete = await this.db.checkDeletePermission(id, session);
    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this User'
      );
    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  list(
    input: UserListInput,
    session: Session
  ): QueryWithResult<{
    items: ID[];
    total: number;
  }> {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('User')])
      .apply(calculateTotalAndPaginateList(User, input));
  }
}
