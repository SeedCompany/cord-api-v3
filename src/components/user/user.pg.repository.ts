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
            about, picture_common_files_id, private_first_name, private_last_name, 
            public_first_name, public_last_name, timezone, created_by_admin_people_id, 
            modified_by_admin_people_id, owning_person_admin_people_id, 
            owning_group_admin_groups_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7,
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id
      ),
      admin_user_email AS (
        INSERT INTO admin.user_email_accounts(
            id, email, created_by_admin_people_id, modified_by_admin_people_id, 
            owning_person_admin_people_id, owning_group_admin_groups_id)
        VALUES ((SELECT id FROM admin_people), $8, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id
      ),
      admin_user_phone AS (
        INSERT INTO admin.user_phone_accounts(
            id, phone, created_by_admin_people_id, modified_by_admin_people_id, 
            owning_person_admin_people_id, owning_group_admin_groups_id)
        VALUES ((SELECT id FROM admin_people), $9, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id
      )
      INSERT INTO sc.people(
          id, status, title, created_by_admin_people_id, modified_by_admin_people_id, 
          owning_person_admin_people_id, owning_group_admin_groups_id) 
      VALUES((SELECT id FROM admin_people), $10, $11, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
		       (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
           (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
           (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.about,
        'pictureId',
        input.realFirstName,
        input.realLastName,
        input.displayFirstName,
        input.displayLastName,
        input.timezone,
        input.email,
        input.phone,
        input.status,
        input.title,
      ]
    );

    //  CREATE OR REPLACE FUNCTION check_role(role varchar) RETURNS varchar LANGUAGE PLPGSQL AS $$
    //     DECLARE
    //       roleId varchar;
    //     BEGIN
    //       IF EXISTS (SELECT r.id FROM admin.roles r WHERE r.name = role) THEN
    // 	          SELECT r.id INTO roleId FROM admin.roles r WHERE r.name = role;

    //       ELSE
    //          INSERT INTO admin.roles (
    //            name, created_by_admin_people_id, modified_by_admin_people_id,
    //            owning_person_admin_people_id, owning_group_admin_groups_id)
    //          VALUES(role,(SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
    //                      (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
    //                      (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
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
             INSERT INTO admin.role_memberships(
                 admin_people_id, admin_role_id, created_by_admin_people_id,
                 modified_by_admin_people_id, owning_person_admin_people_id, owning_group_admin_groups_id)
             VALUES($1, (SELECT check_role($2)), (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
             (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
             (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
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
          p.id, ue.email as "email", 
          p.private_first_name as "realFirstName", 
          p.private_last_name as "realLastName",
          p.public_first_name as "displayFirstName", 
          p.public_last_name as "displayLastName", 
          pa.phone, p.timezone, p.about,
          sp.status, sp.title,
          p.created_at as "createdAt"
      FROM admin.people as p
		  JOIN admin.user_email_accounts as ue ON p.id = ue.id
		  JOIN admin.user_phone_accounts as pa ON p.id = pa.id
      JOIN sc.people as sp ON p.id = sp.id AND p.id = $1;
        `,
      [id]
    );

    const [roles] = await this.pg.query<{ roles: Role[] }>(
      `
      SELECT array_agg(r.name) as "roles"
      FROM admin.roles as r
      JOIN admin.role_memberships as rm ON rm.admin_role_id = r.id
      JOIN admin.people as p ON rm.admin_people_id = p.id AND p.id = $1
      GROUP BY r.id;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find user ${id}`);
    }

    return {
      ...rows[0],
      roles: roles.roles ?? [],
    };
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<User>>> {
    let rows = await this.pg.query<UnsecuredDto<User>>(
      `
      SELECT
          p.id, ue.email as "email", 
          p.private_first_name as "realFirstName", 
          p.private_last_name as "realLastName",
          p.public_first_name as "displayFirstName", 
          p.public_last_name as "displayLastName", 
          pa.phone, p.timezone, p.about,
          sp.status, sp.title,
          p.created_at as "createdAt"
      FROM admin.people as p
      JOIN admin.user_email_accounts as ue ON p.id = ue.id
		  JOIN admin.user_phone_accounts as pa ON p.id = pa.id
      JOIN sc.people as sp ON p.id = sp.id AND  p.id = ANY($1::text[]);
      `,
      [ids]
    );

    if (!rows) {
      throw new NotFoundException(`Could not find users`);
    }

    const roles = await this.pg.query<{ roles: string[]; id: string }>(
      `
      SELECT array_agg(r.name) as "roles", p.id as id
      FROM admin.roles r
      JOIN admin.role_memberships as rm ON rm.admin_role_id = r.id
      JOIN admin.people as p ON rm.admin_people_id = p.id AND p.id = ANY($1::text[])
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
      FROM admin.people p, admin.user_email_accounts u
      WHERE u.id = p.id;
      `
    );

    let rows = await this.pg.query<UnsecuredDto<User>>(
      `
      SELECT
          p.id, ue.email as "email", 
          p.private_first_name as "realFirstName", 
          p.private_last_name as "realLastName",
          p.public_first_name as "displayFirstName", 
          p.public_last_name as "displayLastName", 
          pa.phone, p.timezone, p.about,
          sp.status, sp.title,
          p.created_at as "createdAt"
      FROM admin.people as p
      JOIN admin.user_email_accounts as ue ON p.id = ue.id
		  JOIN admin.user_phone_accounts as pa ON p.id = pa.id
      JOIN sc.people as sp ON p.id = sp.id
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const roles = await this.pg.query<{ roles: string[]; id: string }>(
      `
      SELECT array_agg(r.name) as "roles", p.id as id
      FROM admin.roles r
      JOIN admin.role_memberships as rm ON rm.admin_role_id = r.id
      JOIN admin.people as p ON rm.admin_people_id = p.id
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
    await this.pg.query(
      'UPDATE user_email_accounts SET email = $1 WHERE id = $2;',
      [email, user.id]
    );
  }

  @PgTransaction()
  async delete(id: ID): Promise<void> {
    await this.pg.query(
      'DELETE FROM admin.user_email_accounts WHERE id = $1;',
      [id]
    );
    await this.pg.query(
      'DELETE FROM admin.user_phone_accounts WHERE id = $1;',
      [id]
    );
    await this.pg.query('DELETE FROM sc.people WHERE id = $1;', [id]);
    await this.pg.query('DELETE FROM admin.people WHERE id = $1;', [id]);
  }

  async doesEmailAddressExist(email: string): Promise<boolean> {
    const rows = await this.pg.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT email FROM admin.user_email_accounts WHERE email = $1)',
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
      modified_by_admin_people_id = (SELECT person FROM admin.tokens WHERE token = 'public')
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
