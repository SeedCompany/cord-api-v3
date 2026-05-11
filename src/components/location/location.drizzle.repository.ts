import { Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotImplementedException,
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
import { locations } from '~/core/drizzle/schema';
import { type ResourceNameLike } from '~/core/resources';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import {
  type CreateLocation,
  Location,
  type LocationListInput,
  type LocationListOutput,
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

    if (input.filter?.name) {
      conditions.push(
        ilike(locations.name, `%${escapeLikePattern(input.filter.name)}%`),
      );
    }
    if (input.filter?.type?.length) {
      conditions.push(inArray(locations.type, [...input.filter.type]));
    }
    if (input.filter?.fundingAccountId) {
      conditions.push(
        eq(locations.fundingAccountId, input.filter.fundingAccountId),
      );
    }

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

  // migration-todo: implement when location-node relationships are migrated to PG
  addLocationToNode(
    _label: ResourceNameLike,
    _id: ID,
    _rel: string,
    _locationId: ID<'Location'>,
  ): Promise<DateTime | null> {
    throw new NotImplementedException();
  }

  // migration-todo: implement when location-node relationships are migrated to PG
  removeLocationFromNode(
    _label: ResourceNameLike,
    _id: ID,
    _rel: string,
    _locationId: ID<'Location'>,
  ): Promise<DateTime | null> {
    throw new NotImplementedException();
  }

  // migration-todo: implement when location-node relationships are migrated to PG
  listLocationsFromNodeNoSecGroups(
    _label: string,
    _rel: string,
    _id: ID,
    _input: LocationListInput,
  ): Promise<LocationListOutput> {
    throw new NotImplementedException();
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
