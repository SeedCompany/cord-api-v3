import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  ResourceShape,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { Privileges, UserEdgePrivileges } from '../authorization';
import { PropAction } from '../authorization/policy/actions';
import { FileService } from '../file';
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
    private readonly files: FileService,
  ) {}

  async create(input: CreateLocation, session: Session): Promise<Location> {
    this.privileges.for(session, Location).verifyCan('create');
    const checkName = await this.repo.doesNameExist(input.name);
    if (checkName) {
      throw new DuplicateException(
        'location.name',
        'Location with this name already exists.',
      );
    }

    const { id, mapImageId } = await this.repo.create(input, session);
    await this.files.createDefinedFile(
      mapImageId,
      input.name,
      session,
      id,
      'mapImage',
      input.mapImage,
      'location.mapImage',
      true,
    );

    this.logger.debug(`location created`, { id: id });
    return await this.readOne(id, session);
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
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const locations = await this.repo.readMany(ids);
    return await Promise.all(locations.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: UnsecuredDto<Location>,
    session: Session,
  ): Promise<Location> {
    return this.privileges.for(session, Location).secure(dto);
  }

  async update(input: UpdateLocation, session: Session): Promise<Location> {
    const location = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(location, input);
    this.privileges.for(session, Location, location).verifyChanges(changes);

    const {
      fundingAccountId,
      defaultFieldRegionId,
      mapImage,
      ...simpleChanges
    } = changes;

    await this.repo.updateProperties(location, simpleChanges);

    if (fundingAccountId !== undefined) {
      await this.repo.updateRelation(
        'fundingAccount',
        'FundingAccount',
        input.id,
        fundingAccountId,
      );
    }

    if (defaultFieldRegionId !== undefined) {
      await this.repo.updateRelation(
        'defaultFieldRegion',
        'FieldRegion',
        input.id,
        defaultFieldRegionId,
      );
    }

    await this.files.updateDefinedFile(
      location.mapImage,
      'location.mapImage',
      mapImage,
      session,
    );

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Location');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Location',
      );

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
    const results = await this.repo.list(input, session);

    return await mapListResults(results, (dto) => this.secure(dto, session));
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
        ? await mapListResults(results, (dto) => this.secure(dto, edge.session))
        : SecuredList.Redacted),
      canRead: edge.can('read'),
      canCreate: edge.can('edit'),
    };
  }
}
