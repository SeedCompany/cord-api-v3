import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import * as argon2 from 'argon2';
import { PropertyUpdaterService } from '../../core';
import { ILogger, Logger } from '../../core/logger';
import {
  OrganizationListInput,
  SecuredOrganizationList,
  OrganizationService,
} from '../organization';
import {
  CreateUser,
  UpdateUser,
  User,
  UserListInput,
  UserListOutput,
} from './dto';
import { IRequestUser } from '../../common';
import { ConfigService } from '../../core';

@Injectable()
export class UserService {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly config: ConfigService,
    private readonly db: Connection,
    private readonly propertyUpdater: PropertyUpdaterService,
    @Logger('user:service') private readonly logger: ILogger,
  ) {}

  async list(input: UserListInput, token: string): Promise<UserListOutput> {
    this.logger.info('Listing users', { input, token });
    throw new Error('Method not implemented.');
  }

  async listOrganizations(
    userId: string,
    input: OrganizationListInput,
    token: IRequestUser,
  ): Promise<SecuredOrganizationList> {
    // Just a thought, seemed like a good idea to try to reuse the logic/query there.
    const result = await this.organizations.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userIds: [userId],
        },
      },
      token,
    );

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }

  async create(input: CreateUser, token: IRequestUser): Promise<User> {

    const pash = await argon2.hash(input.password);
    /** CREATE USER
     * get the token, then create the user with minimum properties
     * create an ACL node and ensure the user can edit their own properties
     */
    const result = await this.db
      .query()
      .raw(
        `
        MATCH (token:Token {active: true, value: $token})
        CREATE
          (user:User {
            id: $id,
            active: true,
            createdAt: datetime(),
            createdByUserId: "system",
            canCreateOrg: true,
            canReadOrgs: true,
            canCreateLang: true,
            canReadLangs: true,
            canDeleteOwnUser: true,
            owningOrgId: "Seed Company"
          })
          -[:email {active: true}]->
          (email:EmailAddress:Property {
            active: true,
            value: $email
          }),
          (user)-[:token {active: true, createdAt: datetime()}]->(token),
          (user)-[:password {active: true, createdAt: datetime()}]->
          (password:Property {
            active: true,
            value: $pash
          }),
          (user)-[:realFirstName {active: true, createdAt: datetime()}]->
          (realFirstName:Property {
            active: true,
            value: $realFirstName
          }),
          (user)-[:realLastName {active: true, createdAt: datetime()}]->
          (realLastName:Property {
            active: true,
            value: $realLastName
          }),
          (user)-[:displayFirstName {active: true, createdAt: datetime()}]->
          (displayFirstName:Property {
            active: true,
            value: $displayFirstName
          }),
          (user)-[:displayLastName {active: true, createdAt: datetime()}]->
          (displayLastName:Property {
            active: true,
            value: $displayLastName
          }),
          (user)<-[:member]-
          (acl:ACL {
            canReadRealFirstName: true,
            canEditRealFirstName: true,
            canReadRealLastName: true,
            canEditRealLastName: true,
            canReadDisplayFirstName: true,
            canEditDisplayFirstName: true,
            canReadDisplayLastName: true,
            canEditDisplayLastName: true,
            canReadPassword: true,
            canEditPassword: true,
            canReadEmail: true,
            canEditEmail: true,
            canReadEducation: true,
            canEditEducation: true
          })
          -[:toNode]->(user)
        RETURN
          user.id as id,
          email.value as email,
          user.createdAt as createdAt,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName,
          acl.canReadRealFirstName as canReadRealFirstName,
          acl.canEditRealFirstName as canEditRealFirstName,
          acl.canReadRealLastName as canReadRealLastName,
          acl.canEditRealLastName as canEditRealLastName,
          acl.canReadDisplayFirstName as canReadDisplayFirstName,
          acl.canEditDisplayFirstName as canEditDisplayFirstName,
          acl.canReadDisplayLastName as canReadDisplayLastName,
          acl.canEditDisplayLastName as canEditDisplayLastName,
          acl.canReadPassword as canReadPassword,
          acl.canEditPassword as canEditPassword,
          acl.canReadEmail as canReadEmail,
          acl.canEditEmail as canEditEmail
        `,
        {
          id: generate(),
          token: token.token,
          email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          displayLastName: input.displayLastName,
          pash,
        },
      )
      .first();
    if (!result) {
      throw new Error('Could not create user');
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      email: {
        value: result.email,
        canRead: result.canReadEmail,
        canEdit: result.canEditEmail,
      },
      realFirstName: {
        value: result.realFirstName,
        canRead: result.canReadRealFirstName,
        canEdit: result.canEditRealFirstName,
      },
      realLastName: {
        value: result.realLastName,
        canRead: result.canReadRealLastName,
        canEdit: result.canEditRealLastName,
      },
      displayFirstName: {
        value: result.displayLastName,
        canRead: result.canReadDisplayFirstName,
        canEdit: result.canEditDisplayFirstName,
      },
      displayLastName: {
        value: result.displayLastName,
        canRead: result.canReadDisplayLastName,
        canEdit: result.canEditDisplayLastName,
      },
      phone: {
        value: '', // TODO
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      timezone: {
        value: '', // TODO
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      bio: {
        value: '', // TODO
        canRead: true, // TODO
        canEdit: true, // TODO
      },
    };
  }

  async readOne(id: string, token: IRequestUser): Promise<User> {
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
          id: $requestingUserId
        })
      WITH * OPTIONAL MATCH (user:User {active: true, id: $id, owningOrgId: $owningOrgId})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl1:ACL {canReadEmail: true})-[:toNode]->(user)-[:email {active: true}]->(email:EmailAddress {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl2:ACL {canEditEmail: true})-[:toNode]->(user)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl3:ACL {canReadRealFirstName: true})-[:toNode]->(user)-[:realFirstName {active: true}]->(realFirstName:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl4:ACL {canEditRealFirstName: true})-[:toNode]->(user)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl5:ACL {canReadRealLastName: true})-[:toNode]->(user)-[:realLastName {active: true}]->(realLastName:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl6:ACL {canEditRealLastName: true})-[:toNode]->(user)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl7:ACL {canReadDisplayFirstName: true})-[:toNode]->(user)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl8:ACL {canEditDisplayFirstName: true})-[:toNode]->(user)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl9:ACL {canReadDisplayLastName: true})-[:toNode]->(user)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl10:ACL {canEditDisplayLastName: true})-[:toNode]->(user)
        RETURN
        user.id as id,
        user.createdAt as createdAt,
        email.value as email,
        realFirstName.value as realFirstName,
        realLastName.value as realLastName,
        displayFirstName.value as displayFirstName,
        displayLastName.value as displayLastName,
        acl1.canReadEmail as canReadEmail,
        acl2.canEditEmail as canEditEmail,
        acl3.canReadRealFirstName as canReadRealFirstName,
        acl4.canEditRealFirstName as canEditRealFirstName,
        acl5.canReadRealLastName as canReadRealLastName,
        acl6.canEditRealLastName as canEditRealLastName,
        acl7.canReadDisplayFirstName as canReadDisplayFirstName,
        acl8.canEditDisplayFirstName as canEditDisplayFirstName,
        acl9.canReadDisplayLastName as canReadDisplayLastName,
        acl10.canEditDisplayLastName as canEditDisplayLastName
        `,
        {
          token: token.token,
          requestingUserId: token.userId,
          id,
          owningOrgId: token.owningOrgId,
        },
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find user');
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      email: {
        value: result.email,
        canRead: result.canReadEmail,
        canEdit: result.canEditEmail,
      },
      realFirstName: {
        value: result.realFirstName,
        canRead: result.canReadRealFirstName,
        canEdit: result.canEditRealFirstName,
      },
      realLastName: {
        value: result.realLastName,
        canRead: result.canReadRealLastName,
        canEdit: result.canEditRealLastName,
      },
      displayFirstName: {
        value: result.displayFirstName,
        canRead: result.canReadDisplayFirstName,
        canEdit: result.canEditDisplayFirstName,
      },
      displayLastName: {
        value: result.displayLastName,
        canRead: result.canReadDisplayLastName,
        canEdit: result.canEditDisplayLastName,
      },
      phone: {
        value: '', // TODO
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      timezone: {
        value: '', // TODO
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      bio: {
        value: '', // TODO
        canRead: true, // TODO
        canEdit: true, // TODO
      },
    };
  }

  async update(input: UpdateUser, token: IRequestUser): Promise<User> {
    const user = await this.readOne(input.id, token);

    return this.propertyUpdater.updateProperties({
      token,
      object: user,
      props: [
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
      ],
      changes: input,
      nodevar: 'user',
    });
  }

  async delete(id: string, token: IRequestUser): Promise<void> {
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
          id: $requestingUserId
        }),
        (requestingUser)
        <-[:member]-(acl:ACL {
          canDeleteOwnUser: true
        })
        -[:toNode]->
        (user:User {
          active: true,
          id: $userToDeleteId
        })
        SET
          user.active = false
        RETURN
          user.id as id
        `,
        {
          requestingUserId: token.userId,
          token: token.token,
          userToDeleteId: id,
        },
      )
      .run();
  }
}
