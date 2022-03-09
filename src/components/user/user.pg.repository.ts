import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { isEmpty, isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import { Role } from '../authorization';
import {
  CreatePerson,
  KnownLanguage,
  LanguageProficiency,
  RemoveOrganizationFromUser,
  UpdateUser,
  User,
  UserListInput,
} from './dto';
import { UserRepository } from './user.repository';

@Injectable()
export class PgUserRepository implements PublicOf<UserRepository> {
  constructor(private readonly pg: Pg) {}

  @PgTransaction()
  async create(input: CreatePerson): Promise<ID> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      WITH admin_people AS (
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
        RETURNING id as userId
      )
      INSERT INTO admin.users(id, email, created_by, modified_by, owning_person, owning_group)
      VALUES ((SELECT userId FROM admin_people), $13, (SELECT person FROM admin.tokens WHERE token = 'public'), 
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
        input.email,
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
      input.roles.forEach((role) => {
        void (async () => {
          await this.pg.query(
            `
             INSERT INTO admin.role_memberships(person, role, created_by, modified_by, owning_person, owning_group) 
             VALUES($1, (SELECT check_role($2)), (SELECT person FROM admin.tokens WHERE token = 'public'), 
             (SELECT person FROM admin.tokens WHERE token = 'public'), 
             (SELECT person FROM admin.tokens WHERE token = 'public'), 
             (SELECT id FROM admin.groups WHERE  name = 'Administrators'));
             `,
            [id, role]
          );
        })();
      });
    }

    if (!id) {
      throw new ServerException('Failed to create user');
    }

    return id;
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

    if (isEmpty(changes)) {
      return;
    }

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
