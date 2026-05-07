import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
} from 'drizzle-orm';
import { groupBy } from 'lodash';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  generateId,
  type ID,
  NotImplementedException,
  type PaginatedListType,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  escapeLikePattern,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { userGlobalRoles, users } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import {
  type AssignOrganizationToUser,
  type CreatePerson,
  type RemoveOrganizationFromUser,
  type SystemAgent,
  type UpdateUser,
  User,
  type UserListInput,
} from './dto';

type UserRow = typeof users.$inferSelect & {
  globalRoles?: Array<typeof userGlobalRoles.$inferSelect>;
};

const catchEmailUnique = catchUniqueViolation(
  'email',
  'email',
  'Email address is already in use',
);

@Injectable()
export class UserDrizzleRepository extends DrizzleDtoRepository<
  typeof users,
  User
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly files: FileService,
    private readonly identity: Identity,
  ) {
    super(db, users);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<User>>> {
    const rows = await this.db.query.users.findMany({
      where: (user) => and(inArray(user.id, [...ids]), isNull(user.deletedAt)),
      with: { globalRoles: true },
    });
    return rows.map((row) => this.toDto(row));
  }

  async readManyActors(ids: readonly ID[]) {
    const [userRows, agentRows] = await Promise.all([
      this.db.query.users.findMany({
        where: (user) =>
          and(inArray(user.id, [...ids]), isNull(user.deletedAt)),
        with: { globalRoles: true },
      }),
      this.db.query.systemAgents.findMany({
        where: (agent) => inArray(agent.id, [...ids]),
      }),
    ]);
    return [
      ...(userRows.map((row) => this.toDto(row)) as Array<
        UnsecuredDto<User | SystemAgent>
      >),
      ...agentRows.map(
        (row) =>
          // migration-todo: SystemAgent is abstract; cast bridges plain row → class shape
          ({
            ...row,
            __typename: 'SystemAgent' as const,
            roles: row.roles,
            createdAt: DateTime.fromJSDate(row.createdAt),
          }) as unknown as UnsecuredDto<User | SystemAgent>,
      ),
    ];
  }

  async create(input: CreatePerson): Promise<{ id: ID }> {
    const id = await generateId();
    const photoId = await generateId<FileId>();

    await this.db
      .insert(users)
      .values({
        id,
        status: input.status ?? 'Active',
        email: input.email ?? null,
        realFirstName: input.realFirstName,
        realLastName: input.realLastName,
        displayFirstName: input.displayFirstName,
        displayLastName: input.displayLastName,
        phone: input.phone ?? null,
        timezone: input.timezone ?? 'America/Chicago',
        about: input.about ?? null,
        title: input.title ?? null,
        gender: input.gender ?? null,
        photoId,
      })
      .catch(catchEmailUnique);

    if (input.roles?.length) {
      await this.db
        .insert(userGlobalRoles)
        .values(input.roles.map((role) => ({ userId: id, role })));
    }

    await this.identity.asUser(id, async () => {
      await this.files.createDefinedFile(
        photoId,
        'Photo',
        id,
        'photo',
        input.photo,
        true,
      );
    });

    return { id };
  }

  async update(changes: UpdateUser): Promise<UnsecuredDto<User>> {
    const { id, roles, email, photo, ...simpleChanges } = changes;

    await this.updateColumns(id, {
      realFirstName: simpleChanges.realFirstName,
      realLastName: simpleChanges.realLastName,
      displayFirstName: simpleChanges.displayFirstName,
      displayLastName: simpleChanges.displayLastName,
      phone: simpleChanges.phone,
      timezone: simpleChanges.timezone,
      about: simpleChanges.about,
      status: simpleChanges.status,
      title: simpleChanges.title,
      gender: simpleChanges.gender,
      email,
    }).catch(catchEmailUnique);

    if (roles !== undefined) {
      await this.db
        .delete(userGlobalRoles)
        .where(eq(userGlobalRoles.userId, id));
      if (roles.length > 0) {
        await this.db
          .insert(userGlobalRoles)
          .values(roles.map((role) => ({ userId: id, role })))
          .onConflictDoNothing();
      }
    }

    if (photo !== undefined) {
      const person = await this.readOne(id);
      if (!person.photo) {
        throw new ServerException(
          'Expected photo file to be updated with this person',
        );
      }
      await this.files.createFileVersion({ ...photo, parent: person.photo.id });
    }

    return await this.readOne(id);
  }

  async delete(id: ID, _object: User): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: UserListInput,
  ): Promise<PaginatedListType<UnsecuredDto<User>>> {
    const resource = EnhancedResource.of(User);
    const filter = this.executor.drizzleFilter({ action: 'read', resource });
    if (filter === false) return { items: [], total: 0, hasMore: false };

    const conditions: SQL[] = [isNull(users.deletedAt)];
    if (filter !== true) conditions.push(filter);
    if (input.filter?.id) conditions.push(eq(users.id, input.filter.id));
    if (input.filter?.status)
      conditions.push(eq(users.status, input.filter.status));
    if (input.filter?.name) {
      const term = `%${escapeLikePattern(input.filter.name)}%`;
      conditions.push(
        or(
          ilike(users.realFirstName, term),
          ilike(users.realLastName, term),
          ilike(users.displayFirstName, term),
          ilike(users.displayLastName, term),
        )!,
      );
    }
    if (input.filter?.title) {
      conditions.push(
        ilike(users.title, `%${escapeLikePattern(input.filter.title)}%`),
      );
    }
    if (input.filter?.roles?.length) {
      const roleSubq = this.db
        .selectDistinct({ userId: userGlobalRoles.userId })
        .from(userGlobalRoles)
        .where(inArray(userGlobalRoles.role, input.filter.roles));
      conditions.push(inArray(users.id, roleSubq));
    }

    const dir = input.order === 'ASC' ? asc : desc;
    const sortColumns = {
      realLastName: [users.realLastName, users.realFirstName],
      displayLastName: [users.displayLastName, users.displayFirstName],
      realFirstName: [users.realFirstName, users.realLastName],
      displayFirstName: [users.displayFirstName, users.displayLastName],
    } satisfies Partial<Record<keyof User, unknown>>;
    const orderCols = (
      sortColumns[input.sort as keyof typeof sortColumns] ?? [users.id]
    ).map(dir);

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: orderCols,
      page: input.page,
      count: input.count,
    });

    const ids = rows.map((row) => row.id);
    const allRoles =
      ids.length > 0
        ? await this.db
            .select()
            .from(userGlobalRoles)
            .where(inArray(userGlobalRoles.userId, ids))
        : [];
    const rolesByUser = groupBy(allRoles, (row) => row.userId);

    return {
      total,
      items: rows.map((row) =>
        this.toDto({ ...row, globalRoles: rolesByUser[row.id] ?? [] }),
      ),
      hasMore,
    };
  }

  async doesEmailAddressExist(email: string): Promise<boolean> {
    const row = await this.db.query.users.findFirst({
      where: (user) => eq(user.email, email),
      columns: { id: true },
    });
    return !!row;
  }

  async getUserByEmailAddress(
    email: string,
  ): Promise<UnsecuredDto<User> | null> {
    const resource = EnhancedResource.of(User);
    const filter = this.executor.drizzleFilter({ action: 'read', resource });
    if (filter === false) return null;

    const conditions: SQL[] = [eq(users.email, email), isNull(users.deletedAt)];
    if (filter !== true) conditions.push(filter);

    const row = await this.db.query.users.findFirst({
      where: () => and(...conditions),
      with: { globalRoles: true },
    });
    return row ? this.toDto(row) : null;
  }

  // migration-todo: implement when Organization domain is migrated to PG
  assignOrganizationToUser(_args: AssignOrganizationToUser): Promise<void> {
    throw new NotImplementedException().with(_args);
  }

  // migration-todo: implement when Organization domain is migrated to PG
  removeOrganizationFromUser(_args: RemoveOrganizationFromUser): Promise<void> {
    throw new NotImplementedException().with(_args);
  }

  // migration-todo: remove when the Neo4j UserRepository is retired
  hydrateAsNeo4j(): never {
    throw new NotImplementedException();
  }

  protected toDto(row: UserRow): UnsecuredDto<User> {
    return {
      id: row.id,
      __typename: 'User',
      createdAt: DateTime.fromJSDate(row.createdAt),
      email: row.email ?? null,
      realFirstName: row.realFirstName,
      realLastName: row.realLastName,
      displayFirstName: row.displayFirstName,
      displayLastName: row.displayLastName,
      phone: row.phone ?? null,
      timezone: row.timezone,
      about: row.about ?? null,
      status: row.status,
      roles: (row.globalRoles ?? []).map((globalRole) => globalRole.role),
      title: row.title ?? null,
      gender: row.gender ?? null,
      photo: row.photoId ? { id: row.photoId } : null,
      // migration-todo: pinned is per-requesting-user state, not stored on the user row
      pinned: false,
    };
  }
}
