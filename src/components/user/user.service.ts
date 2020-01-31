import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
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

@Injectable()
export class UserService {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly db: Connection,
    @Logger('user:service') private readonly logger: ILogger,
  ) {}

  async list(input: UserListInput, token: string): Promise<UserListOutput> {
    this.logger.info('Listing users', { input, token });
    throw new Error('Method not implemented.');
  }

  async listOrganizations(
    userId: string,
    input: OrganizationListInput,
    token: string,
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
            canReadOrgs: true
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
            value: $password
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
            canEditEmail: true
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
          password: input.password,
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
        canRead: result.canReadDisplayLastName,
        canEdit: result.canEditDisplayLastName,
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

  async readOne(id: string, token: string): Promise<User> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (user:User {active: true, id: $id}),
          (user)-[:email {active: true}]->(email:EmailAddress {active: true}),
          (user)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
          (user)-[:realLastName {active: true}]->(realLastName:Property {active: true}),
          (user)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
          (user)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
        RETURN
          user.id as id,
          email.value as email,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName
        `,
        {
          id,
          token,
        },
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find user');
    }

    return {
      id: result.id,
      createdAt: DateTime.local(), // TODO
      email: {
        value: result.email,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      realFirstName: {
        value: result.realFirstName,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      realLastName: {
        value: result.realLastName,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      displayFirstName: result.displayFirstName,
      displayLastName: result.displayFirstName,
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

  async update(input: UpdateUser, token: string): Promise<User> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (user:User {active: true, id: $id}),
          (user)-[:email {active: true}]->(email:EmailAddress {active: true}),
          (user)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
          (user)-[:realLastName {active: true}]->(realLastName:Property {active: true}),
          (user)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
          (user)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
        SET
          email.value = $email,
          realFirstName.value = $realFirstName,
          realLastName.value = $realLastName,
          displayFirstName.value = $displayFirstName,
          displayLastName.value = $displayLastName
        RETURN
          user.id as id,
          email.value as email,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName
        `,
        {
          id: input.id,
          // email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          displayLastName: input.displayLastName,
        },
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find user');
    }

    return {
      id: result.id,
      createdAt: DateTime.local(), // TODO
      email: {
        value: result.email,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      realFirstName: {
        value: result.realFirstName,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      realLastName: {
        value: result.realLastName,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      displayFirstName: result.displayFirstName,
      displayLastName: result.displayFirstName,
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

  async delete(id: string, token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
        MATCH
          (user:User {active: true, id: $id})
        SET
          user.active = false
        RETURN
          user.id as id
        `,
        {
          id,
        },
      )
      .run();
  }
}
