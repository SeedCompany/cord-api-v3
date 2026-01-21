import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  type ResourceShape,
  SecuredList,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, type ResourceNameLike } from '~/core';
import { Privileges, type UserEdgePrivileges } from '../authorization';
import { type PropAction } from '../authorization/policy/actions';
import {
  type CreateLocation,
  Location,
  type LocationListInput,
  type LocationListOutput,
  type SecuredLocationList,
  type UpdateLocation,
} from './dto';
import { LocationRepository } from './location.repository';

@Injectable()
export class LocationService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: LocationRepository,
  ) {}

  async create(input: CreateLocation): Promise<Location> {
    this.privileges.for(Location).verifyCan('create');

    const dto = await this.repo.create(input);

    return this.secure(dto);
  }

  @HandleIdLookup(Location)
  async readOne(id: ID, _view?: ObjectView): Promise<Location> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const locations = await this.repo.readMany(ids);
    return locations.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<Location>) {
    return this.privileges.for(Location).secure(dto);
  }

  async update(input: UpdateLocation): Promise<Location> {
    const location = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(location, input);
    this.privileges.for(Location, location).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(Location, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: LocationListInput): Promise<LocationListOutput> {
    // no canList check needed because all roles can list
    const results = await this.repo.list(input);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  async addLocationToNode(
    label: ResourceNameLike,
    id: ID,
    rel: string,
    locationId: ID<'Location'>,
  ) {
    return await this.repo.addLocationToNode(label, id, rel, locationId);
  }

  async removeLocationFromNode(
    label: ResourceNameLike,
    id: ID,
    rel: string,
    locationId: ID<'Location'>,
  ) {
    return await this.repo.removeLocationFromNode(label, id, rel, locationId);
  }

  async listLocationForResource<TResourceStatic extends ResourceShape<any>>(
    edge: UserEdgePrivileges<TResourceStatic, string, PropAction>,
    dto: InstanceType<TResourceStatic>,
    input: LocationListInput,
  ): Promise<SecuredLocationList> {
    const results = await this.repo.listLocationsFromNodeNoSecGroups(
      edge.resource.dbLabel,
      edge.key,
      dto.id,
      input,
    );

    return {
      ...(edge.can('read')
        ? {
            ...results,
            items: results.items.map((dto) => this.secure(dto)),
          }
        : SecuredList.Redacted),
      canRead: edge.can('read'),
      canCreate: edge.can('edit'),
    };
  }
}
