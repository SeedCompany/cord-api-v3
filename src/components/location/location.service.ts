import { forwardRef, Inject, Injectable } from '@nestjs/common';
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
import { AuthorizationService } from '../authorization/authorization.service';
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
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: LocationRepository
  ) {}

  async create(input: CreateLocation, session: Session): Promise<Location> {
    const checkName = await this.repo.doesNameExist(input.name);
    if (checkName) {
      throw new DuplicateException(
        'location.name',
        'Location with this name already exists.'
      );
    }

    const id = await this.repo.create(input, session);

    await this.authorizationService.processNewBaseNode(
      Location,
      id,
      session.userId
    );

    this.logger.debug(`location created`, { id: id });
    return await this.readOne(id, session);
  }

  @HandleIdLookup(Location)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<Location> {
    this.logger.debug(`Read Location`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const locations = await this.repo.readMany(ids, session);
    return await Promise.all(locations.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: UnsecuredDto<Location>,
    session: Session
  ): Promise<Location> {
    const securedProps = await this.authorizationService.secureProperties(
      Location,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(input: UpdateLocation, session: Session): Promise<Location> {
    const location = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(location, input);
    await this.authorizationService.verifyCanEditChanges(
      Location,
      location,
      changes
    );

    const { fundingAccountId, defaultFieldRegionId, ...simpleChanges } =
      changes;

    await this.repo.updateProperties(location, simpleChanges);

    if (fundingAccountId) {
      await this.repo.updateFundingAccount(input.id, fundingAccountId, session);
    }

    if (defaultFieldRegionId) {
      await this.repo.updateDefaultFieldRegion(
        input.id,
        defaultFieldRegionId,
        session
      );
    }

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
        'You do not have the permission to delete this Location'
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
    session: Session
  ): Promise<LocationListOutput> {
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
    locationId: ID
  ) {
    try {
      await this.repo.removeLocationFromNode(label, id, rel, locationId);
    } catch (e) {
      throw new ServerException(`Could not remove location from ${label}`, e);
    }
  }

  async listLocationForResource<TResource extends ResourceShape<any>>(
    label: TResource,
    dto: TResource['prototype'],
    rel: keyof TResource['prototype'] | keyof TResource['Relations'],
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    const perms = await this.authorizationService.getPermissions({
      resource: label,
      sessionOrUserId: session,
      dto,
    });

    const results = await this.repo.listLocationsFromNodeNoSecGroups(
      label.name,
      rel as string,
      dto.id,
      input
    );

    return {
      ...(perms[rel].canRead
        ? await mapListResults(results, (dto) => this.secure(dto, session))
        : SecuredList.Redacted),
      canRead: perms[rel].canRead,
      canCreate: perms[rel].canEdit,
    };
  }

  async listLocationsFromNode(
    label: string,
    id: ID,
    rel: string,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    const results = await this.repo.listLocationsFromNode(
      label,
      id,
      rel,
      input,
      session
    );

    return {
      ...(await mapListResults(results, (dto) => this.secure(dto, session))),
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }
}
