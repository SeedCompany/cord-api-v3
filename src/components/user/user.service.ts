import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { generate } from 'shortid';
import { DatabaseService, ILogger, Logger, OnIndex } from '../../core';
import { ISession } from '../auth';
import {
  OrganizationListInput,
  OrganizationService,
  SecuredOrganizationList,
} from '../organization';
import {
  CreateUser,
  UpdateUser,
  User,
  UserListInput,
  UserListOutput,
} from './dto';

@Injectable()
export class UserService {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly db: DatabaseService,
    @Logger('user:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    // language=Cypher (for webstorm)
    const constraints = [
      // USER NODE
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:User) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.owningOrgId)',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.owningOrgId)',

      // EMAIL REL
      'CREATE CONSTRAINT ON ()-[r:email]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:email]-() ASSERT EXISTS(r.createdAt)',

      // EMAIL NODE
      'CREATE CONSTRAINT ON (n:EmailAddress) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:EmailAddress) ASSERT n.value IS UNIQUE',

      // PASSWORD REL
      'CREATE CONSTRAINT ON ()-[r:password]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:password]-() ASSERT EXISTS(r.createdAt)',

      // PROPERTY NODE
      'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.active)',
    ];
    for (const query of constraints) {
      await this.db
        .query()
        .raw(query)
        .run();
    }
  }

  async list(
    { page, count, sort, order, filter }: UserListInput,
    session: ISession
  ): Promise<UserListOutput> {
    const result = await this.db.list<User>({
      session,
      nodevar: 'user',
      aclReadProp: 'canReadUsers',
      aclEditProp: 'canCreateUser',
      props: [
        'email',
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
        'phone',
        'timezone',
        'bio',
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async listOrganizations(
    userId: string,
    input: OrganizationListInput,
    session: ISession
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
      session
    );

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }

  async checkEmail(email: string): Promise<boolean> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (email:EmailAddress {
          value: $email
        })
        RETURN
        email.value as email
        `,
        {
          email: email,
        }
      )
      .first();
    if (result) {
      return false;
    }
    return true;
  }

  async logout(token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token)-[r]-()
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

  async create(input: CreateUser, session: ISession): Promise<User> {
    if (!input.password) {
      throw new Error('Password is required when creating a new user');
    }

    // ensure token doesn't have any users attached to it
    // await this.logout(session.token);

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
            canCreateFileNode: true,
            canCreateOrg: true,
            canReadOrgs: true,
            canReadUsers: true,
            canCreateLang: true,
            canReadLangs: true,
            canCreateEducation: true,
            canReadEducationList: true,
            canCreateUnavailability: true,
            canReadUnavailabilityList: true,
            canCreatePartnership: true,
            canReadPartnerships: true,
            canCreateProduct: true,
            canReadProducts: true,
            canCreateProject: true,
            canReadProjects: true,
            canDeleteOwnUser: true,
            owningOrgId: "Seed Company",
            isAdmin: true
          })
          -[:email {active: true, createdAt: datetime()}]->
          (email:EmailAddress:Property {
            active: true,
            value: $email,
            createdAt: datetime()
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
          (user)-[:phone {active: true, createdAt: datetime()}]->
          (phone:Property {
            active: true,
            value: $phone
          }),
          (user)-[:timezone {active: true, createdAt: datetime()}]->
          (timezone:Property {
            active: true,
            value: $timezone
          }),
          (user)-[:bio {active: true, createdAt: datetime()}]->
          (bio:Property {
            active: true,
            value: $bio
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
            canReadEducationList: true,
            canEditEducation: true,
            canReadPhone: true,
            canEditPhone: true,
            canReadTimezone: true,
            canEditTimezone: true,
            canReadBio: true,
            canEditBio: true,
            canReadFile: true,
            canEditFile: true,
            canCreateFile: true
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
          phone.value as phone,
          timezone.value as timezone,
          bio.value as bio,
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
          acl.canEditEmail as canEditEmail,
          acl.canReadPhone as canReadPhone,
          acl.canEditPhone as canEditPhone,
          acl.canReadTimezone as canReadTimezone,
          acl.canEditTimezone as canEditTimezone,
          acl.canReadBio as canReadBio,
          acl.canEditBio as canEditBio
        `,
        {
          id: generate(),
          token: session.token,
          email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          displayLastName: input.displayLastName,
          phone: input.phone,
          timezone: input.timezone,
          bio: input.bio,
          pash,
        }
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
        value: result.phone,
        canRead: result.canReadPhone,
        canEdit: result.canEditPhone,
      },
      timezone: {
        value: result.timezone,
        canRead: result.canReadTimezone,
        canEdit: result.canEditTimezone,
      },
      bio: {
        value: result.bio,
        canRead: result.canReadBio,
        canEdit: result.canEditBio,
      },
    };
  }

  async readOne(id: string, session: ISession): Promise<User> {
    const result = await this.propertyUpdater.readProperties({
      id,
      session,
      props: [
        'email',
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
        'phone',
        'timezone',
        'bio',
        'createdAt',
        'id',
      ],
      nodevar: 'user',
    });

    if (!result) {
      throw new NotFoundException('Could not find user');
    }
    let user = result as any;
    user.id = result.id.value;
    user.createdAt = result.createdAt.value;
    user = user as User;

    return user;
  }

  async update(input: UpdateUser, session: ISession): Promise<User> {
    const user = await this.readOne(input.id, session);

    return this.db.updateProperties({
      session,
      object: user,
      props: [
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
        'phone',
        'timezone',
        'bio',
      ],
      changes: input,
      nodevar: 'user',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const user = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: user,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Could not delete user', { exception: e });
      throw e;
    }
  }
}
