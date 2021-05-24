import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  runListQuery,
} from '../../core/database/results';
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
import { DbLocation } from './model';

@Injectable()
export class LocationService {
  constructor(
    @Logger('location:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: LocationRepository
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Location) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Location) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Location) ASSERT EXISTS(n.createdAt)',

      // LOCATION NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',

      // LOCATION TYPE NODE
      'CREATE CONSTRAINT ON (n:LocationType) ASSERT EXISTS(n.value)',
    ];
  }

  async create(input: CreateLocation, session: Session): Promise<Location> {
    const checkName = await this.repo.checkName(input.name);

    if (checkName) {
      throw new DuplicateException(
        'location.name',
        'Location with this name already exists.'
      );
    }
    const createdAt = DateTime.local();

    const result = await this.repo.create(session, input);

    if (!result) {
      throw new ServerException('failed to create location');
    }

    if (input.fundingAccountId) {
      await this.repo.createProperties(
        'fundingAccount',
        result,
        input,
        createdAt
      );
    }

    if (input.defaultFieldRegionId) {
      await this.repo.createProperties(
        'defaultFieldRegion',
        result,
        input,
        createdAt
      );
    }

    const dbLocation = new DbLocation();
    await this.authorizationService.processNewBaseNode(
      dbLocation,
      result.id,
      session.userId
    );

    this.logger.debug(`location created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<Location> {
    this.logger.debug(`Read Location`, {
      id: id,
      userId: session.userId,
    });

    const query = this.repo.readOne(id, session);

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find location', 'location.id');
    }

    const secured = await this.authorizationService.secureProperties(
      Location,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      defaultFieldRegion: {
        ...secured.defaultFieldRegion,
        value: result.defaultFieldRegionId,
      },
      fundingAccount: {
        ...secured.fundingAccount,
        value: result.fundingAccountId,
      },
      canDelete: await this.repo.checkDeletePermission(id, session),
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
      await this.repo.updateLocationProperties(
        'fundingAccount',
        session,
        fundingAccountId,
        input.id
      );
    }

    if (defaultFieldRegionId) {
      await this.repo.updateLocationProperties(
        'defaultFieldRegion',
        session,
        defaultFieldRegionId,
        input.id
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
    { filter, ...input }: LocationListInput,
    session: Session
  ): Promise<LocationListOutput> {
    const query = this.repo.list({ filter, ...input }, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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

  async listLocationsFromNode(
    label: string,
    id: ID,
    rel: string,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    const query = this.repo.listLocationsFromNode(
      label,
      id,
      rel,
      input,
      session
    );

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }
}
