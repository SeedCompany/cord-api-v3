import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { isNil, omitBy } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  PaginatedListType,
  PublicOf,
  ResourceShape,
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
  Pg,
  UniquenessError,
} from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import {
  ACTIVE,
  collect,
  createNode,
  createProperty,
  deactivateProperty,
  filter,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  property,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import { PgTransaction } from '../../core/postgres/transaction.decorator';
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
export class UserRepository extends DtoRepository<typeof User, [Session | ID]>(
  User
) {
  constructor(
    db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {
    super(db);
  }

  private readonly roleProperties = (roles?: Role[]) =>
    (roles || []).flatMap((role) =>
      property('roles', role, 'node', `role${role}`)
    );

  async create(input: CreatePerson) {
    const initialProps = {
      ...(input.email ? { email: input.email } : {}), // omit email prop/relation if it's undefined
      realFirstName: input.realFirstName,
      realLastName: input.realLastName,
      displayFirstName: input.displayFirstName,
      displayLastName: input.displayLastName,
      phone: input.phone,
      timezone: input.timezone,
      about: input.about,
      status: input.status,
      title: input.title,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(User, { initialProps }))
      .apply((q) =>
        input.roles && input.roles.length > 0
          ? q.create([...this.roleProperties(input.roles)])
          : q
      )
      .return<{ id: ID }>('node.id as id');
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
    const id = result.id;
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
    return result.id;
  }

  hydrate(requestingUserId: Session | ID) {
    return (query: Query) =>
      query
        .optionalMatch([
          node('node'),
          relation('out', '', 'roles', ACTIVE),
          node('role', 'Property'),
        ])
        .apply(matchProps())
        .match(requestingUser(requestingUserId))
        .return<{ dto: UnsecuredDto<User> }>(
          merge({ email: null }, 'props', {
            roles: collect('role.value'),
            pinned: 'exists((requestingUser)-[:pinned]->(node))',
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
          relation('out', 'oldRoleRel', 'roles', ACTIVE),
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
      .matchNode('node', 'User')
      .apply(matchRequestingUser(session))
      .apply(
        filter.builder(input.filter, {
          pinned: filter.isPinned,
        })
      )
      .apply(sorting(User, input))
      .apply(paginate(input, this.hydrate(session.userId)))
      .first();
    return result!; // result from paginate() will always have 1 row.
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

  async listKnownLanguages(userId: ID, _session: Session) {
    const results = await this.db
      .query()
      .match([
        node('node', 'Language'),
        relation('in', 'knownLanguageRel', 'knownLanguage', ACTIVE),
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
            relation('out', 'oldRel', 'organization', ACTIVE),
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
        relation('out', 'primary', 'primaryOrganization', ACTIVE),
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

@Injectable()
export class PgUserRepository implements PublicOf<UserRepository> {
  constructor(private readonly pg: Pg) {}

  @PgTransaction()
  async create(input: CreatePerson): Promise<ID> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO admin.people(
          about, phone, picture, private_first_name,
          private_last_name, public_first_name, 
          public_last_name, private_full_name,
          public_full_name, timezone, title,
          status, created_by, modified_by, 
          owning_person, owning_group)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.about,
        input.phone,
        'picture',
        input.realFirstName,
        input.realLastName,
        input.displayFirstName,
        input.displayLastName,
        `${input.realFirstName} ${input.realLastName}`,
        `${input.displayFirstName} ${input.displayLastName}`,
        'timezone',
        input.title,
        input.status,
      ]
    );

    //  CREATE OR REPLACE FUNCTION check_role(role varchar) RETURNS varchar LANGUAGE PLPGSQL AS $$
    //     DECLARE
    //       roleId varchar;
    //     BEGIN
    //       IF EXISTS (SELECT r.id FROM admin.roles r WHERE r.name = role) THEN
    // 	          SELECT r.id INTO roleId FROM admin.roles r WHERE r.name = role;

    //       ELSE
    //          INSERT INTO admin.roles (name, created_by, modified_by, owning_person, owning_group)
    //          VALUES(role,(SELECT person FROM admin.tokens WHERE token = 'public'),
    //                      (SELECT person FROM admin.tokens WHERE token = 'public'),
    //                      (SELECT person FROM admin.tokens WHERE token = 'public'),
    //                      (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
    //          RETURNING id INTO roleId;
    //       END IF;

    //     RETURN roleId;

    //  END;
    //  $$;

    if (input.roles) {
      input.roles.forEach(
        (role) => async () =>
          await this.pg.query(
            `
          INSERT INTO admin.role_memberships(person, role, created_by, modified_by, owning_person, owning_group) 
          VALUES($1, (SELECT check_role($2)), (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators')) 
          `,
            [id, role]
          )
      );
    }

    const [userId] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO admin.users(id, email, created_by, modified_by, owning_person, owning_group)
      VALUES ($1, $2, (SELECT person FROM admin.tokens WHERE token = 'public'), 
              (SELECT person FROM admin.tokens WHERE token = 'public'), 
              (SELECT person FROM admin.tokens WHERE token = 'public'), 
              (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [id, input.email]
    );

    if (!userId.id) {
      throw new ServerException('Failed to create user');
    }
    return userId.id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<User>> {
    const rows = await this.pg.query<UnsecuredDto<User>>(
      `
        SELECT
            p.id, u.email as "email", 
            p.private_first_name as "realFirstName", 
            p.private_last_name as "realLastName",
            p.public_first_name as "publicFirstName", 
            p.public_last_name as "publicLastName", 
            p.phone, p.timezone, p.about, p.status,
            p.title, p.created_at as "createdAt"
        FROM admin.people as p, admin.users as u
        WHERE p.id = $1 AND p.id = u.id;
        `,
      [id]
    );

    const [roles] = await this.pg.query<{ roles: Role[] }>(
      `
      SELECT array_agg(r.name) as "roles"
      FROM admin.role_memberships rm, admin.roles r, admin.people p
      WHERE rm.role = r.id AND rm.person = p.id AND p.id = $1
      GROUP BY r.id
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find user ${id}`);
    }
    return {
      ...rows[0],
      roles: roles ? roles.roles : [],
    };
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<User>>> {
    let rows = await this.pg.query<UnsecuredDto<User>>(
      `
      SELECT
          p.id, u.email as "email", 
          p.private_first_name as "realFirstName", 
          p.private_last_name as "realLastName",
          p.public_first_name as "publicFirstName", 
          p.public_last_name as "publicLastName", 
          p.phone, p.timezone, p.about,  
          p.status, p.title, p.created_at as "createdAt"
      FROM admin.people as p, admin.users as u
      WHERE p.id = u.id AND p.id = ANY($1::text[])
      `,
      [ids]
    );

    if (!rows) {
      throw new NotFoundException(`Could not find users`);
    }

    // TODO: Merge this in a single query
    const roles = await this.pg.query<{ roles: string[]; id: string }>(
      `
      SELECT array_agg(r.name) as "roles", p.id as id
      FROM admin.role_memberships rm, admin.roles r, admin.people p
      WHERE rm.role = r.id AND rm.person = p.id AND p.id = ANY($1::text[])
      GROUP BY p.id;
      `,
      [ids]
    );

    const mapRoles = new Map(roles.map((key) => [key.id, key.roles]));
    rows = rows.map((row) => {
      return { ...row, roles: (mapRoles.get(row.id) as Role[]) ?? [] };
    });

    return rows;
  }

  async list(
    input: UserListInput
  ): Promise<PaginatedListType<UnsecuredDto<User>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM admin.people p, admin.users u
      WHERE u.id = p.id;
      `
    );

    let rows = await this.pg.query<UnsecuredDto<User>>(
      `
      SELECT
          p.id, u.email "email", 
          p.private_first_name "realFirstName", 
          p.private_last_name "realLastName",
          p.public_first_name "displayFirstName", 
          p.public_last_name "displayLastName", 
          p.phone, p.timezone, p.about, 
          p.status, p.title, p.created_at "createdAt"
      FROM admin.people as p, admin.users as u
      WHERE p.id = u.id
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    // TODO: Merge this in a single query
    const roles = await this.pg.query<{ roles: string[]; id: string }>(
      `
      SELECT array_agg(r.name) as "roles", p.id as id
      FROM admin.role_memberships rm, admin.roles r, admin.people p
      WHERE rm.role = r.id AND rm.person = p.id
      GROUP BY p.id;
      `
    );

    const mapRoles = new Map(roles.map((key) => [key.id, key.roles]));
    rows = rows.map((row) => {
      return { ...row, roles: (mapRoles.get(row.id) as Role[]) ?? [] };
    });

    const userList: PaginatedListType<UnsecuredDto<User>> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return userList;
  }

  async updateEmail(
    user: User,
    email: string | null | undefined
  ): Promise<void> {
    await this.pg.query('UPDATE admin.users SET email = $1 WHERE id = $2;', [
      email,
      user.id,
    ]);
  }

  @PgTransaction()
  async delete(id: ID): Promise<void> {
    await this.pg.query('DELETE FROM admin.users WHERE id = $1;', [id]);
    await this.pg.query('DELETE FROM admin.people WHERE id = $1;', [id]);
  }

  async doesEmailAddressExist(email: string): Promise<boolean> {
    const rows = await this.pg.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT email FROM admin.users WHERE email = $1)',
      [email]
    );

    return rows[0].exists;
  }

  async update(input: UpdateUser) {
    const { id, email, roles, ...rest } = input;
    type Changes = Omit<Required<UpdateUser>, 'email' | 'id' | 'roles'>;
    const changes = omitBy(rest, isNil) as Changes;

    const updates = Object.keys(changes)
      .map((key) =>
        key === 'realFirstName'
          ? `private_first_name = '${changes.realFirstName}'`
          : key === 'realLastName'
          ? `private_last_name = '${changes.realLastName}'`
          : key === 'displayFirstName'
          ? `public_first_name = '${changes.displayFirstName}'`
          : key === 'displayLastName'
          ? `public_last_name = '${changes.displayLastName}'`
          : `${key} = '${changes[key as keyof Changes]}'`
      )
      .join(', ');

    const rows = await this.pg.query(
      `
      UPDATE admin.people
      SET ${updates}, modified_at = CURRENT_TIMESTAMP, 
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = '${id}'
      RETURNING id;
      `
    );

    if (!rows[0]) {
      throw new ServerException(`Could not update user ${id}`);
    }

    return rows[0];
  }

  updateRoles(
    _input: UpdateUser,
    _removals: Role[],
    _additions: Role[]
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  permissionsForListProp(
    _prop: string,
    _userId: ID,
    _session: Session
  ): Promise<{ canRead: boolean; canCreate: boolean }> {
    throw new Error('Method not implemented.');
  }
  createKnownLanguage(
    _userId: ID,
    _languageId: ID,
    _languageProficiency: LanguageProficiency
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deleteKnownLanguage(
    _userId: ID,
    _languageId: ID,
    _languageProficiency: LanguageProficiency
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  listKnownLanguages(
    _userId: ID,
    _session: Session
  ): Promise<readonly KnownLanguage[]> {
    throw new Error('Method not implemented.');
  }

  assignOrganizationToUser(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  removeOrganizationFromUser(
    _request: RemoveOrganizationFromUser
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  hydrate(
    _requestingUserId: Session | ID
  ): (query: Query) => Query<{ dto: UnsecuredDto<User> }> {
    throw new Error('Method not implemented.');
  }
  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof User>,
    Changes extends ChangesOf<TResource>
  >(
    _existingObject: TResource,
    _changes: Changes & Record<any, any>
  ) => Partial<any>;
  isUnique(_value: string, _label?: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }
  updateProperties<
    TObject extends Partial<MaybeUnsecuredInstance<typeof User>> & { id: ID }
  >(
    _object: TObject,
    _changes: DbChanges<User>,
    _changeset?: ID
  ): Promise<TObject> {
    throw new Error('Method not implemented.');
  }
  updateRelation(
    _relationName: string,
    _otherLabel: string,
    _id: ID,
    _otherId: ID | null
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  checkDeletePermission(_id: ID, _session: Session | ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
