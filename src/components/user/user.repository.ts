import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  DtoRepository,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
  PostgresService,
  property,
  UniquenessError,
} from '../../core';
import {
  collect,
  createNode,
  createProperty,
  deactivateProperty,
  matchProps,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { Role } from '../authorization';
import {
  AssignOrganizationToUser,
  CreatePerson,
  KnownLanguage,
  LanguageProficiency,
  RemoveOrganizationFromUser,
  UpdateUser,
  User,
  UserListInput,
} from './dto';

@Injectable()
export class UserRepository extends DtoRepository(User) {
  constructor(
    db: DatabaseService,
    private readonly pg: PostgresService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {
    super(db);
  }

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

  private readonly roleProperties = (roles?: Role[]) =>
    (roles || []).flatMap((role) =>
      property('roles', role, 'node', `role${role}`)
    );
  async readOne(id: ID) {
    const query = this.db
      .query()
      .match([node('node', 'User', { id })])
      .apply(this.hydrate())
      .return('dto')
      .asResult<{ dto: UnsecuredDto<User> }>();
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }
    // const client = await this.pg.pool.connect();
    // let [pgPersonData, pgUserData] = await Promise.all([
    //   client.query('select * from public.people_data where id = $1', [0]),
    //   client.query(`select * from public.users_data where person = $1`, [0]),
    // ]);
    // let {
    //   public_last_name: displayLastName,
    //   public_first_name: displayFirstName,
    //   private_first_name: realFirstName,
    //   private_last_name: realLastName,
    //   time_zone: timezone,
    //   created_at: createdAt,
    //   phone,
    //   about,
    //   status,
    // } = pgPersonData.rows[0];

    // let { email, password } = pgUserData.rows[0];
    // client.release();
    // return {
    //   displayFirstName,
    //   displayLastName,
    //   realFirstName,
    //   realLastName,
    //   timezone,
    //   id,
    //   email,
    //   password,
    //   createdAt,
    //   phone,
    //   about,
    //   status,
    //   roles: null,
    //   title: null,
    // };
    return result.dto;
  }

  async create(input: CreatePerson) {
    // await this.pg.init();
    const id = await generateId();
    const createdAt = DateTime.local();
    const query = this.db
      .query()
      .create([
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
      ])
      .return('user.id as id')
      .asResult<{ id: ID }>();
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
    const client = await this.pg.pool.connect();
    // await client.query(`select * from public.people_data`);

    await client.query(
      `call public.create(0,'public.people_data',$1 ,2,1,1,1); `,
      [
        this.pg.convertObjectToHstore({
          id: 1,
          public_first_name: input.displayFirstName,
          public_last_name: input.displayLastName,
          private_first_name: input.realFirstName,
          private_last_name: input.realLastName,
          time_zone: input.timezone,
          about: input.about,
          phone: input.phone,
        }),
      ]
    );
    // await client.query(
    //   `call public.create(0,'public.organizations_data', $1, 2,1,1,1)`,
    //   [
    //     this.pg.convertObjectToHstore({
    //       id: 1,
    //       name: 'dOrg',
    //     }),
    //   ]
    // );
    await client.query(
      `call public.create(0,'public.users_data',$1 ,2,1,1,1); `,
      [
        this.pg.convertObjectToHstore({
          id: 1,
          person: 1,
          email: input.email,
          password: 'password',
          owning_org: 0,
        }),
      ]
    );

    client.release();
    return result.id;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .optionalMatch([
          node('node'),
          relation('out', '', 'roles', { active: true }),
          node('role', 'Property'),
        ])
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<User> }>(
          merge({ email: null }, 'props', {
            roles: collect('role.value'),
          }).as('dto')
        );
  }

  async updateEmail(
    user: User,
    email: string | null | undefined
  ): Promise<void> {
    await this.db
      .query()
      .matchNode('node', 'User', { id: user.id })
      .apply(deactivateProperty({ resource: User, key: 'email' }))
      .apply((q) =>
        email
          ? q.apply(
              createProperty({ resource: User, key: 'email', value: email })
            )
          : q
      )
      .return('*')
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
          node('node', ['User', 'BaseNode'], {
            id: input.id,
          }),
        ])
        .create([...this.roleProperties(additions)])
        .run();
    }
  }

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

  async list(input: UserListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('User')])
      .apply(sorting(User, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async permissionsForListProp(prop: string, userId: ID, session: Session) {
    const result = await this.db
      .query()
      .match(matchSession(session)) // Michel Query Refactor Will Fix This
      .match([node('user', 'User', { id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfReadSecurityGroup', 'member'),
        node('readSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgReadPerms', 'permission'),
        node('canRead', 'Permission', {
          property: prop,
          read: true,
        }),
        relation('out', 'readPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfEditSecurityGroup', 'member'),
        node('editSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgEditPerms', 'permission'),
        node('canEdit', 'Permission', {
          property: prop,
          edit: true,
        }),
        relation('out', 'editPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead' }],
        canEdit: [{ edit: 'canEdit' }],
      })
      .asResult<{ canRead?: boolean; canEdit?: boolean }>()
      .first();
    const client = await this.pg.pool.connect();
    const pgResult = await client.query(
      `delete from public.people_data where id = $1`,
      [0]
    );
    console.log(pgResult);
    client.release();
    if (!result) {
      throw new NotFoundException('Could not find user', 'userId');
    }
    return {
      canRead: result.canRead ?? false,
      canCreate: result.canEdit ?? false,
    };
  }

  async createKnownLanguage(
    userId: ID,
    languageId: ID,
    languageProficiency: LanguageProficiency
  ): Promise<void> {
    await this.db
      .query()
      .matchNode('user', 'User', { id: userId })
      .matchNode('language', 'Language', { id: languageId })
      .create([
        node('user'),
        relation('out', '', 'knownLanguage', {
          active: true,
          createdAt: DateTime.local(),
          value: languageProficiency,
        }),
        node('language'),
      ])
      .run();
  }

  async deleteKnownLanguage(
    userId: ID,
    languageId: ID,
    languageProficiency: LanguageProficiency
  ): Promise<void> {
    await this.db
      .query()
      .matchNode('user', 'User', { id: userId })
      .matchNode('language', 'Language', { id: languageId })
      .match([
        [
          node('user'),
          relation('out', 'rel', 'knownLanguage', {
            active: true,
            value: languageProficiency,
          }),
          node('language'),
        ],
      ])
      .setValues({
        'rel.active': false,
      })
      .run();
  }

  async listKnownLanguages(userId: ID, session: Session) {
    const results = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Language'),
        relation('in', 'knownLanguageRel', 'knownLanguage', { active: true }),
        node('user', 'User', { id: userId }),
      ])
      .with('collect(distinct user) as users, node, knownLanguageRel')
      .raw(`unwind users as user`)
      .return(['knownLanguageRel.value as proficiency', 'node.id as language'])
      .asResult<KnownLanguage>()
      .run();
    return results;
  }

  async doesEmailAddressExist(email: string) {
    const result = await this.db
      .query()
      .matchNode('email', 'EmailAddress', { value: email })
      .return('email.value')
      .first();
    return !!result;
  }

  async assignOrganizationToUser({
    userId,
    orgId,
    primary,
  }: AssignOrganizationToUser) {
    await this.db
      .query()
      .match([
        [node('user', 'User', { id: userId })],
        [node('org', 'Organization', { id: orgId })],
      ])
      .subQuery((sub) =>
        sub
          .with('user, org')
          .match([
            node('user'),
            relation('out', 'oldRel', 'organization', { active: true }),
            node('org'),
          ])
          .setValues({ 'oldRel.active': false })
          .return('oldRel')
          .union()
          .return('null as oldRel')
      )
      .apply((q) => {
        if (primary) {
          q.subQuery((sub) =>
            sub
              .with('user, org')
              .match([
                node('user'),
                relation('out', 'oldRel', 'primaryOrganization', {
                  active: true,
                }),
                node('org'),
              ])
              .setValues({ 'oldRel.active': false })
              .return('oldRel as oldPrimaryRel')
              .union()
              .return('null as oldPrimaryRel')
          );
        }
      })
      .return('oldRel')
      .run();

    const userToOrg = (label: string) => [
      node('user'),
      relation('out', '', label, {
        active: true,
        createdAt: DateTime.local(),
      }),
      node('org'),
    ];
    const result = await this.db
      .query()
      .match([
        [node('org', 'Organization', { id: orgId })],
        [node('user', 'User', { id: userId })],
      ])
      .create([
        userToOrg('organization'),
        ...(primary ? [userToOrg('primaryOrganization')] : []),
      ])
      .return('org.id')
      .first();
    if (!result) {
      throw new ServerException('Failed to assign organization to user');
    }
  }

  async removeOrganizationFromUser(request: RemoveOrganizationFromUser) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User', {
          id: request.userId,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('org', 'Organization', {
          id: request.orgId,
        }),
      ])
      .optionalMatch([
        node('user'),
        relation('out', 'primary', 'primaryOrganization', { active: true }),
        node('org'),
      ])
      .setValues({ 'oldRel.active': false })
      .return({ oldRel: [{ id: 'oldId' }], primary: [{ id: 'primaryId' }] })
      .asResult<{ primaryId: ID; oldId: ID }>()
      .first();

    // TODO Refactor this into one query and make these two relationships independent or combine into one.
    if (result?.primaryId) {
      const removePrimary = this.db
        .query()
        .match([
          node('user', 'User', {
            id: request.userId,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            id: request.orgId,
          }),
        ])
        .setValues({ 'oldRel.active': false })
        .return('oldRel');
      await removePrimary.first();
    }
  }
}
