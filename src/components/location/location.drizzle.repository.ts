import { Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type PaginatedListType,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  languageLocations,
  languages,
  locations,
  organizationLocations,
  organizations,
  projectOtherLocations,
  projects,
  userLocations,
  users,
} from '~/core/drizzle/schema';
import { type ResourceNameLike } from '~/core/resources';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import {
  type CreateLocation,
  Location,
  type LocationFilters,
  type LocationListInput,
  type UpdateLocation,
} from './dto';

const catchNameUnique = catchUniqueViolation(
  'name',
  'name',
  'Location with this name already exists.',
);

@Injectable()
export class LocationDrizzleRepository extends DrizzleDtoRepository<
  typeof locations,
  Location
> {
  constructor(
    db: DrizzleService,
    private readonly files: FileService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, locations, Location);
  }

  async create(input: CreateLocation): Promise<UnsecuredDto<Location>> {
    const id = await generateId();
    const mapImageId = await generateId<FileId>();

    await this.db
      .insert(locations)
      .values({
        id,
        name: input.name,
        type: input.type,
        isoAlpha3: input.isoAlpha3 ?? null,
        fundingAccountId: input.fundingAccount ?? null,
        defaultFieldRegionId: input.defaultFieldRegion ?? null,
        defaultMarketingRegionId: input.defaultMarketingRegion ?? null,
        mapImageId,
      })
      .catch(catchNameUnique);

    const dto = await this.readOne(id);

    await this.files.createDefinedFile(
      mapImageId,
      input.name,
      id,
      'mapImage',
      input.mapImage,
      true,
    );

    return dto;
  }

  async update(changes: UpdateLocation): Promise<UnsecuredDto<Location>> {
    const { id, mapImage, ...fields } = changes;

    await this.updateColumns(id, {
      name: fields.name,
      type: fields.type,
      isoAlpha3: fields.isoAlpha3,
      fundingAccountId: fields.fundingAccount,
      defaultFieldRegionId: fields.defaultFieldRegion,
      defaultMarketingRegionId: fields.defaultMarketingRegion,
    }).catch(catchNameUnique);

    if (mapImage !== undefined) {
      const location = await this.readOne(id);
      if (!location.mapImage) {
        throw new ServerException(
          'Expected map image file to be updated with the location',
        );
      }
      await this.files.createFileVersion({
        ...mapImage,
        parent: location.mapImage.id,
      });
    }

    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: LocationListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Location>>> {
    const conditions: SQL[] = [isNull(locations.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    conditions.push(...locationFilterClauses(input.filter));

    const sortColumns = {
      name: locations.name,
      type: locations.type,
      isoAlpha3: locations.isoAlpha3,
      createdAt: locations.createdAt,
    } satisfies SortMap<keyof Location>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, locations.name),
      page: input.page,
      count: input.count,
    });
    return {
      total,
      items: rows.map((row) => this.toDto(row)),
      hasMore,
    };
  }

  async addLocationToNode(
    label: ResourceNameLike,
    id: ID,
    rel: string,
    locationId: ID<'Location'>,
  ): Promise<DateTime | null> {
    await this.assertLiveLocation(locationId);
    await this.assertLiveResource(label, id);

    if (label === 'Organization' && rel === 'locations') {
      const inserted = await this.db
        .insert(organizationLocations)
        .values({ organizationId: id as ID<'Organization'>, locationId })
        .onConflictDoNothing()
        .returning();
      return inserted.length > 0 ? DateTime.now() : null;
    }
    if (label === 'User' && rel === 'locations') {
      const inserted = await this.db
        .insert(userLocations)
        .values({ userId: id as ID<'User'>, locationId })
        .onConflictDoNothing()
        .returning();
      return inserted.length > 0 ? DateTime.now() : null;
    }
    if (label === 'Language' && rel === 'locations') {
      const inserted = await this.db
        .insert(languageLocations)
        .values({ languageId: id as ID<'Language'>, locationId })
        .onConflictDoNothing()
        .returning();
      return inserted.length > 0 ? DateTime.now() : null;
    }
    if (label === 'Project' && rel === 'otherLocations') {
      const inserted = await this.db
        .insert(projectOtherLocations)
        .values({ projectId: id as ID<'Project'>, locationId })
        .onConflictDoNothing()
        .returning();
      return inserted.length > 0 ? DateTime.now() : null;
    }
    throw new ServerException(`Unsupported location edge: ${label}.${rel}`);
  }

  async removeLocationFromNode(
    label: ResourceNameLike,
    id: ID,
    rel: string,
    locationId: ID<'Location'>,
  ): Promise<DateTime | null> {
    await this.assertLiveLocation(locationId);
    await this.assertLiveResource(label, id);

    if (label === 'Organization' && rel === 'locations') {
      const deleted = await this.db
        .delete(organizationLocations)
        .where(
          and(
            eq(organizationLocations.organizationId, id as ID<'Organization'>),
            eq(organizationLocations.locationId, locationId),
          ),
        )
        .returning();
      return deleted.length > 0 ? DateTime.now() : null;
    }
    if (label === 'User' && rel === 'locations') {
      const deleted = await this.db
        .delete(userLocations)
        .where(
          and(
            eq(userLocations.userId, id as ID<'User'>),
            eq(userLocations.locationId, locationId),
          ),
        )
        .returning();
      return deleted.length > 0 ? DateTime.now() : null;
    }
    if (label === 'Language' && rel === 'locations') {
      const deleted = await this.db
        .delete(languageLocations)
        .where(
          and(
            eq(languageLocations.languageId, id as ID<'Language'>),
            eq(languageLocations.locationId, locationId),
          ),
        )
        .returning();
      return deleted.length > 0 ? DateTime.now() : null;
    }
    if (label === 'Project' && rel === 'otherLocations') {
      const deleted = await this.db
        .delete(projectOtherLocations)
        .where(
          and(
            eq(projectOtherLocations.projectId, id as ID<'Project'>),
            eq(projectOtherLocations.locationId, locationId),
          ),
        )
        .returning();
      return deleted.length > 0 ? DateTime.now() : null;
    }
    throw new ServerException(`Unsupported location edge: ${label}.${rel}`);
  }

  async listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Location>>> {
    const linkedLocationIds =
      label === 'Organization' && rel === 'locations'
        ? this.db
            .select({ id: organizationLocations.locationId })
            .from(organizationLocations)
            .where(
              eq(
                organizationLocations.organizationId,
                id as ID<'Organization'>,
              ),
            )
        : label === 'User' && rel === 'locations'
          ? this.db
              .select({ id: userLocations.locationId })
              .from(userLocations)
              .where(eq(userLocations.userId, id as ID<'User'>))
          : label === 'Language' && rel === 'locations'
            ? this.db
                .select({ id: languageLocations.locationId })
                .from(languageLocations)
                .where(eq(languageLocations.languageId, id as ID<'Language'>))
            : label === 'Project' && rel === 'otherLocations'
              ? this.db
                  .select({ id: projectOtherLocations.locationId })
                  .from(projectOtherLocations)
                  .where(
                    eq(projectOtherLocations.projectId, id as ID<'Project'>),
                  )
              : null;
    if (!linkedLocationIds) {
      throw new ServerException(`Unsupported location edge: ${label}.${rel}`);
    }

    const conditions: SQL[] = [
      isNull(locations.deletedAt),
      inArray(locations.id, linkedLocationIds),
    ];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(...locationFilterClauses(input.filter));

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, locationSortColumns, locations.name),
      page: input.page,
      count: input.count,
    });
    return {
      total,
      items: rows.map((row) => this.toDto(row)),
      hasMore,
    };
  }

  /** Confirms `locationId` refers to a live Location, or throws. */
  private async assertLiveLocation(locationId: ID<'Location'>): Promise<void> {
    const [row] = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), isNull(locations.deletedAt)));
    if (!row) {
      throw new NotFoundException('Location not found', 'location');
    }
  }

  /** Confirms `id` refers to a live row of the resource named by `label`, or throws. */
  private async assertLiveResource(
    label: ResourceNameLike,
    id: ID,
  ): Promise<void> {
    const rows =
      label === 'Organization'
        ? await this.db
            .select({ id: organizations.id })
            .from(organizations)
            .where(
              and(
                eq(organizations.id, id as ID<'Organization'>),
                isNull(organizations.deletedAt),
              ),
            )
        : label === 'User'
          ? await this.db
              .select({ id: users.id })
              .from(users)
              .where(
                and(eq(users.id, id as ID<'User'>), isNull(users.deletedAt)),
              )
          : label === 'Language'
            ? await this.db
                .select({ id: languages.id })
                .from(languages)
                .where(
                  and(
                    eq(languages.id, id as ID<'Language'>),
                    isNull(languages.deletedAt),
                  ),
                )
            : label === 'Project'
              ? await this.db
                  .select({ id: projects.id })
                  .from(projects)
                  .where(
                    and(
                      eq(projects.id, id as ID<'Project'>),
                      isNull(projects.deletedAt),
                    ),
                  )
              : null;
    if (!rows) {
      throw new ServerException(`Unsupported location edge resource: ${label}`);
    }
    if (rows.length === 0) {
      throw new NotFoundException('Resource not found');
    }
  }

  protected toDto(row: typeof locations.$inferSelect): UnsecuredDto<Location> {
    return {
      id: row.id,
      __typename: 'Location',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      type: row.type,
      isoAlpha3: row.isoAlpha3 ?? null,
      fundingAccount: row.fundingAccountId
        ? { id: row.fundingAccountId }
        : null,
      defaultFieldRegion: row.defaultFieldRegionId
        ? { id: row.defaultFieldRegionId }
        : null,
      defaultMarketingRegion: row.defaultMarketingRegionId
        ? { id: row.defaultMarketingRegionId }
        : null,
      mapImage: row.mapImageId ? { id: row.mapImageId } : null,
    };
  }
}

/**
 * Sortable columns on `locations`. Exported for cross-domain sort
 * (Project sorts by `primaryLocation.*`), parallel to `*FilterClauses`.
 */
export const locationSortColumns = {
  name: locations.name,
  type: locations.type,
  isoAlpha3: locations.isoAlpha3,
  createdAt: locations.createdAt,
} satisfies SortMap<keyof Location>;

/**
 * Build the column-level WHERE clauses for a `LocationFilters` input against
 * the `locations` table. Reusable from sub-filters in other domains
 * (e.g. Project's `location` filter).
 */
export const locationFilterClauses = (
  filter: LocationFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.name) {
    conditions.push(
      ilike(locations.name, `%${escapeLikePattern(filter.name)}%`),
    );
  }
  if (filter.type?.length) {
    conditions.push(inArray(locations.type, [...filter.type]));
  }
  if (filter.fundingAccountId) {
    conditions.push(eq(locations.fundingAccountId, filter.fundingAccountId));
  }
  return conditions;
};
