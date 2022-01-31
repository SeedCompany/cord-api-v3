import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  getFromCordTables,
  ID,
  PaginatedListType,
  Session,
  transformToDto,
  transformToPayload,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  CreateLocation,
  Location,
  LocationListInput,
  TablesLocations,
  TablesReadLocation,
  UpdateLocation,
} from './dto';

@Injectable()
export class LocationRepository extends DtoRepository(Location) {
  async create(input: CreateLocation, _session: Session) {
    const response = await getFromCordTables('sc/locations/create-read', {
      location: {
        ...transformToPayload(input, CreateLocation.TablesToDto),
      },
    });
    const iLocation: TablesReadLocation = JSON.parse(response.body);

    const dto: UnsecuredDto<Location> = transformToDto(
      iLocation.location,
      CreateLocation.TablesToDto
    );
    return dto;
  }

  async readOne(id: ID) {
    const response = await getFromCordTables('sc/locations/read', {
      id: id,
    });
    const location = response.body;
    const iLocation: TablesReadLocation = JSON.parse(location);

    const dto: UnsecuredDto<Location> = transformToDto(
      iLocation.location,
      Location.TablesToDto
    );
    return dto;
  }

  async update(
    location: Location,
    updates: Partial<Omit<UpdateLocation, 'id'>>
  ) {
    const updatePayload = transformToPayload(
      updates,
      UpdateLocation.TablesToDto
    );
    Object.entries(updatePayload).forEach(([key, value]) => {
      void getFromCordTables('sc/locations/update', {
        id: location.id,
        column: key,
        value: value,
      });
    });
  }

  async list({ filter, ...input }: LocationListInput, _session: Session) {
    const response = await getFromCordTables('sc/locations/list', {
      sort: input.sort,
      order: input.order,
      page: input.page,
      resultsPerPage: input.count,
    });
    const locations = response.body;
    const iLocations: TablesLocations = JSON.parse(locations);

    const locationArray: Array<UnsecuredDto<Location>> =
      iLocations.locations.map((location) => {
        return transformToDto(location, Location.TablesToDto);
      });
    const totalLoaded = input.count * (input.page - 1) + locationArray.length;
    const locationList: PaginatedListType<UnsecuredDto<Location>> = {
      items: locationArray,
      total: totalLoaded,
      hasMore: totalLoaded < iLocations.size,
    };
    return locationList;
  }

  async delete(location: Location) {
    return await getFromCordTables('sc/locations/delete', {
      id: location.id,
    });
  }

  async addLocationToNode(label: string, id: ID, rel: string, locationId: ID) {
    await this.db
      .query()
      .matchNode('node', label, { id })
      .matchNode('location', 'Location', { id: locationId })
      .create([
        node('node'),
        relation('out', '', rel, {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('location'),
      ])
      .run();
  }

  async removeLocationFromNode(
    label: string,
    id: ID,
    rel: string,
    locationId: ID
  ) {
    await this.db
      .query()
      .matchNode('node', label, { id })
      .matchNode('location', 'Location', { id: locationId })
      .match([
        node('node'),
        relation('out', 'rel', rel, ACTIVE),
        node('location'),
      ])
      .setValues({
        'rel.active': false,
      })
      .run();
  }

  async listLocationsFromNode(
    label: string,
    id: ID,
    rel: string,
    input: LocationListInput,
    session: Session
  ) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Location'),
        relation('in', '', rel, ACTIVE),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(sorting(Location, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput
  ) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Location'),
        relation('in', '', rel, ACTIVE),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(sorting(Location, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
