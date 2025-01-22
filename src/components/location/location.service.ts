import { Injectable } from '@nestjs/common';
import {
  ID,
  ObjectView,
  ResourceShape,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ILogger, Logger } from '~/core';
import { Privileges, UserEdgePrivileges } from '../authorization';
import { PropAction } from '../authorization/policy/actions';
import {
  CreateLocation,
  Location,
  LocationListInput,
  LocationListOutput,
  SecuredLocationList,
  UpdateLocation,
} from './dto';
import { LocationRepository } from './location.repository';

@Injectable()
export class LocationService {
  constructor(
    @Logger('location:service') private readonly logger: ILogger,
    private readonly privileges: Privileges,
    private readonly repo: LocationRepository,
  ) {}

  async create(input: CreateLocation, session: Session): Promise<Location> {
    this.privileges.for(session, Location).verifyCan('create');

    const dto = await this.repo.create(input, session);

    this.logger.debug(`location created`, { id: dto.id });
    return this.secure(dto, session);
  }

  @HandleIdLookup(Location)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Location> {
    this.logger.debug(`Read Location`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const locations = await this.repo.readMany(ids);
    return locations.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<Location>, session: Session) {
    return this.privileges.for(session, Location).secure(dto);
  }

  async update(input: UpdateLocation, session: Session): Promise<Location> {
    const location = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(location, input);
    this.privileges.for(session, Location, location).verifyChanges(changes);

    const updated = await this.repo.update(
      { id: input.id, ...changes },
      session,
    );
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, Location, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: LocationListInput,
    session: Session,
  ): Promise<LocationListOutput> {
    // no canList check needed because all roles can list
    const results = await this.repo.list(input);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }

  async addLocationToNode(label: string, id: ID, rel: string, locationId: ID) {
    try {
      await this.removeLocationFromNode(label, id, rel, locationId);

      await this.repo.addLocationToNode(label, id, rel, locationId);
    } catch (e) {
      throw new ServerException(`Could not add location to ${label}`, e);
    }
  }

  async removeLocationFromNode(
    label: string,
    id: ID,
    rel: string,
    locationId: ID,
  ) {
    try {
      await this.repo.removeLocationFromNode(label, id, rel, locationId);
    } catch (e) {
      throw new ServerException(`Could not remove location from ${label}`, e);
    }
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
            items: results.items.map((dto) => this.secure(dto, edge.session)),
          }
        : SecuredList.Redacted),
      canRead: edge.can('read'),
      canCreate: edge.can('edit'),
    };
  }
}
