import { Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { groupBy } from 'lodash';
import { DateTime } from 'luxon';
import {
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
  EMPTY_PAGE,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  partners,
  userGlobalRoles,
  userOrganizations,
  users,
} from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import { pinnedByRequester } from '../pin/pinned-by-requester';
import {
  type AssignOrganizationToUser,
  type CreatePerson,
  type RemoveOrganizationFromUser,
  type SystemAgent,
  type UpdateUser,
  User,
  type UserFilters,
  type UserListInput,
} from './dto';

type UserRow = typeof users.$inferSelect & {
  globalRoles?: Array<typeof userGlobalRoles.$inferSelect>;
  isIntern?: boolean;
  pinned?: boolean;
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
    super(db, users, User);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<User>>> {
    const [rows, interns] = await Promise.all([
      this.db.query.users.findMany({
        where: (user) =>
          and(inArray(user.id, [...ids]), isNull(user.deletedAt)),
        with: { globalRoles: true },
      }),
      this.internUserIds(ids),
    ]);
    const pinnedSet = await pinnedByRequester(
      this.db,
      this.identity.currentMaybe?.userId,
      rows.map((r) => r.id),
    );
    return rows.map((row) =>
      this.toDto({
        ...row,
        isIntern: interns.has(row.id),
        pinned: pinnedSet.has(row.id),
      }),
    );
  }

  /**
   * The subset of `ids` who are the intern on ≥1 live InternshipEngagement —
   * feeds the `isIntern` flag the IsIntern policy condition reads. Must stay
   * in lockstep with IsInternCondition.asDrizzleCondition (same predicate).
   */
  private async internUserIds(
    ids: readonly ID[],
  ): Promise<ReadonlySet<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .selectDistinct({ id: engagements.internId })
      .from(engagements)
      .where(
        and(
          inArray(engagements.internId, [...ids]),
          eq(engagements.type, 'Internship'),
          isNull(engagements.deletedAt),
        ),
      );
    return new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
  }

  async readManyActors(ids: readonly ID[]) {
    const [userRows, agentRows, interns] = await Promise.all([
      this.db.query.users.findMany({
        where: (user) =>
          and(inArray(user.id, [...ids]), isNull(user.deletedAt)),
        with: { globalRoles: true },
      }),
      this.db.query.systemAgents.findMany({
        where: (agent) => inArray(agent.id, [...ids]),
      }),
      this.internUserIds(ids),
    ]);
    return [
      ...(userRows.map((row) =>
        this.toDto({ ...row, isIntern: interns.has(row.id) }),
      ) as Array<UnsecuredDto<User | SystemAgent>>),
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

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: UserListInput,
  ): Promise<PaginatedListType<UnsecuredDto<User>>> {
    const conditions: SQL[] = [isNull(users.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(...userFilterClauses(this.db, input.filter));

    const sortColumns = {
      fullName: [users.realFirstName, users.realLastName],
      realLastName: [users.realLastName, users.realFirstName],
      displayLastName: [users.displayLastName, users.displayFirstName],
      realFirstName: [users.realFirstName, users.realLastName],
      displayFirstName: [users.displayFirstName, users.displayLastName],
    } satisfies SortMap<keyof User | 'fullName'>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, users.id),
      page: input.page,
      count: input.count,
    });

    const ids = rows.map((row) => row.id);
    const [allRoles, interns] = await Promise.all([
      ids.length > 0
        ? this.db
            .select()
            .from(userGlobalRoles)
            .where(inArray(userGlobalRoles.userId, ids))
        : [],
      this.internUserIds(ids),
    ]);
    const rolesByUser = groupBy(allRoles, (row) => row.userId);
    const pinnedSet = await pinnedByRequester(
      this.db,
      this.identity.currentMaybe?.userId,
      ids,
    );

    return {
      total,
      items: rows.map((row) =>
        this.toDto({
          ...row,
          globalRoles: rolesByUser[row.id] ?? [],
          isIntern: interns.has(row.id),
          pinned: pinnedSet.has(row.id),
        }),
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
    const conditions: SQL[] = [eq(users.email, email), isNull(users.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) return null;

    const row = await this.db.query.users.findFirst({
      where: and(...conditions),
      with: { globalRoles: true },
    });
    if (!row) return null;
    const interns = await this.internUserIds([row.id]);
    return this.toDto({ ...row, isIntern: interns.has(row.id) });
  }

  async assignOrganizationToUser({
    user,
    org,
    primary,
  }: AssignOrganizationToUser): Promise<void> {
    if (primary) {
      // Enforce one primary org per user (also backed by the
      // user_organizations_one_primary_per_user partial unique index).
      await this.db
        .update(userOrganizations)
        .set({ primary: false })
        .where(
          and(
            eq(userOrganizations.userId, user),
            eq(userOrganizations.primary, true),
          ),
        );
    }
    try {
      await this.db
        .insert(userOrganizations)
        .values({
          userId: user,
          organizationId: org,
          primary: primary ?? false,
        })
        .onConflictDoUpdate({
          target: [userOrganizations.userId, userOrganizations.organizationId],
          set: { primary: primary ?? false },
        });
    } catch (exception) {
      throw new ServerException(
        'Failed to assign organization to user',
        exception,
      );
    }
  }

  async removeOrganizationFromUser({
    user,
    org,
  }: RemoveOrganizationFromUser): Promise<void> {
    await this.db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, user),
          eq(userOrganizations.organizationId, org),
        ),
      );
  }

  // migration-todo: remove when the Neo4j UserRepository is retired
  hydrateAsNeo4j(): never {
    throw new NotImplementedException();
  }

  /**
   * Public wrapper around `toDto` so other domains' repos (e.g. ProjectMember)
   * can hydrate a User from a raw row without duplicating logic. The row should
   * be loaded with `globalRoles`. `isIntern` stays unset here — embedded users
   * aren't edit targets, so the IsIntern policy condition never reads them.
   */
  mapRowToDto(row: UserRow): UnsecuredDto<User> {
    return this.toDto(row);
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
      // Per-requester pin state — populated by readMany/list via
      // pinnedByRequester; other internal paths (actors, byEmail) leave it false.
      pinned: row.pinned ?? false,
      isIntern: row.isIntern,
    };
  }
}

/**
 * Build the column-level WHERE clauses for a `UserFilters` input against the
 * `users` table. Reusable from sub-filters in other domains (e.g. FieldZone's
 * `director` filter) — the caller composes these with their own join/lookup.
 *
 * Note: `pinned` is not stored on the user row (per-requester state), so it is
 * intentionally not handled here — same migration-todo as the user list itself.
 */
export const userFilterClauses = (
  db: DrizzleDb,
  filter: UserFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.id) conditions.push(eq(users.id, filter.id));
  if (filter.status) conditions.push(eq(users.status, filter.status));
  if (filter.name) {
    const term = `%${escapeLikePattern(filter.name)}%`;
    conditions.push(
      or(
        ilike(users.realFirstName, term),
        ilike(users.realLastName, term),
        ilike(users.displayFirstName, term),
        ilike(users.displayLastName, term),
      )!,
    );
  }
  if (filter.title) {
    conditions.push(ilike(users.title, `%${escapeLikePattern(filter.title)}%`));
  }
  if (filter.roles?.length) {
    const roleSubq = db
      .selectDistinct({ userId: userGlobalRoles.userId })
      .from(userGlobalRoles)
      .where(inArray(userGlobalRoles.role, filter.roles));
    conditions.push(inArray(users.id, roleSubq));
  }
  if (filter.partnerId) {
    const partnerUserIdsSubq = db
      .selectDistinct({ userId: userOrganizations.userId })
      .from(userOrganizations)
      .innerJoin(
        partners,
        eq(partners.organizationId, userOrganizations.organizationId),
      )
      .where(
        and(eq(partners.id, filter.partnerId), isNull(partners.deletedAt)),
      );
    conditions.push(inArray(users.id, partnerUserIdsSubq));
  }
  return conditions;
};
