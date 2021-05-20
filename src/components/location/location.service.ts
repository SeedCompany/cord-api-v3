import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  NotFoundException,
  ResourceShape,
  Sensitivity,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchProps,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, runListQuery } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateLocation,
  Location,
  LocationListInput,
  LocationListOutput,
  SecuredLocationList,
  UpdateLocation,
} from './dto';
import { DbLocation } from './model';

@Injectable()
export class LocationService {
  constructor(
    @Logger('location:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
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
    const checkName = await this.db
      .query()
      .match([node('name', 'LocationName', { value: input.name })])
      .return('name')
      .first();

    if (checkName) {
      throw new DuplicateException(
        'location.name',
        'Location with this name already exists.'
      );
    }

    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'LocationName',
      },
      {
        key: 'isoAlpha3',
        value: input.isoAlpha3,
        isPublic: false,
        isOrgPublic: false,
        label: 'IsoAlpha3',
      },
      {
        key: 'type',
        value: input.type,
        isPublic: false,
        isOrgPublic: false,
        label: 'LocationType',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create location
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Location', secureProps))
      .return('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create location');
    }

    if (input.fundingAccountId) {
      await this.db
        .query()
        .matchNode('location', 'Location', {
          id: result.id,
        })
        .matchNode('fundingAccount', 'FundingAccount', {
          id: input.fundingAccountId,
        })
        .create([
          node('location'),
          relation('out', '', 'fundingAccount', {
            active: true,
            createdAt,
          }),
          node('fundingAccount'),
        ])
        .run();
    }

    if (input.defaultFieldRegionId) {
      await this.db
        .query()
        .matchNode('location', 'Location', {
          id: result.id,
        })
        .matchNode('defaultFieldRegion', 'FieldRegion', {
          id: input.defaultFieldRegionId,
        })
        .create([
          node('location'),
          relation('out', '', 'defaultFieldRegion', {
            active: true,
            createdAt,
          }),
          node('defaultFieldRegion'),
        ])
        .run();
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

  async readOne<TResource extends ResourceShape<any>>(
    id: ID,
    session: Session,
    parentProp?: keyof TResource['prototype'],
    parentResource?: TResource,
    parentSensitivity?: Sensitivity
  ): Promise<Location> {
    this.logger.debug(`Read Location`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Location', { id: id })])
      .apply(matchProps())
      .optionalMatch([
        node('node'),
        relation('out', '', 'fundingAccount', { active: true }),
        node('fundingAccount', 'FundingAccount'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'defaultFieldRegion', { active: true }),
        node('defaultFieldRegion', 'FieldRegion'),
      ])
      .return(
        'apoc.map.merge(props, { fundingAccount: fundingAccount.id, defaultFieldRegion: defaultFieldRegion.id }) as props'
      )
      .asResult<{ props: DbPropsOfDto<Location, true> }>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find location', 'location.id');
    }
    let secured;
    if (parentProp && parentResource) {
      secured = await this.authorizationService.getPermissionsByProp({
        resource: Location,
        parentResource: parentResource,
        sessionOrUserId: session,
        sensitivity: parentSensitivity,
        parentProp: parentProp,
        props: result.props,
      });
    } else {
      secured = await this.authorizationService.secureProperties({
        resource: Location,
        props: result.props,
        sessionOrUserId: session,
      });
    }

    return {
      ...result.props,
      ...secured,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateLocation, session: Session): Promise<Location> {
    const location = await this.readOne(input.id, session);

    const changes = this.db.getActualChanges(Location, location, input);
    await this.authorizationService.verifyCanEditChanges(
      Location,
      location,
      changes
    );

    const {
      fundingAccountId,
      defaultFieldRegionId,
      ...simpleChanges
    } = changes;

    await this.db.updateProperties({
      type: Location,
      object: location,
      changes: simpleChanges,
    });

    if (fundingAccountId) {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .apply(matchRequestingUser(session))
        .matchNode('location', 'Location', { id: input.id })
        .matchNode('newFundingAccount', 'FundingAccount', {
          id: fundingAccountId,
        })
        .optionalMatch([
          node('location'),
          relation('out', 'oldFundingAccountRel', 'fundingAccount', {
            active: true,
          }),
          node('fundingAccount', 'FundingAccount'),
        ])
        .create([
          node('location'),
          relation('out', '', 'fundingAccount', {
            active: true,
            createdAt,
          }),
          node('newFundingAccount'),
        ])
        .set({
          values: {
            'oldFundingAccountRel.active': false,
          },
        })
        .run();
    }

    if (defaultFieldRegionId) {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .apply(matchRequestingUser(session))
        .matchNode('location', 'Location', { id: input.id })
        .matchNode('newDefaultFieldRegion', 'FieldRegion', {
          id: defaultFieldRegionId,
        })
        .optionalMatch([
          node('location'),
          relation('out', 'oldDefaultFieldRegionRel', 'defaultFieldRegion', {
            active: true,
          }),
          node('defaultFieldRegion', 'FieldRegion'),
        ])
        .create([
          node('location'),
          relation('out', '', 'defaultFieldRegion', {
            active: true,
            createdAt,
          }),
          node('newDefaultFieldRegion'),
        ])
        .set({
          values: {
            'oldDefaultFieldRegionRel.active': false,
          },
        })
        .run();
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Location');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Location'
      );

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    { filter, ...input }: LocationListInput,
    session: Session
  ): Promise<LocationListOutput> {
    const label = 'Location';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(Location, input));

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async addLocationToNode(label: string, id: ID, rel: string, locationId: ID) {
    try {
      await this.removeLocationFromNode(label, id, rel, locationId);
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
      await this.db
        .query()
        .matchNode('node', label, { id })
        .matchNode('location', 'Location', { id: locationId })
        .match([
          [
            node('node'),
            relation('out', 'rel', rel, { active: true }),
            node('location'),
          ],
        ])
        .setValues({
          'rel.active': false,
        })
        .run();
    } catch (e) {
      throw new ServerException(`Could not remove location from ${label}`, e);
    }
  }

  async listLocationsFromNode<TResource extends ResourceShape<any>>(
    label: string,
    id: ID,
    rel: string,
    input: LocationListInput,
    session: Session,
    parentProp?: keyof TResource['prototype'],
    parentResource?: TResource,
    parentSensitivity?: Sensitivity
  ): Promise<SecuredLocationList> {
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Location'),
        relation('in', '', rel, { active: true }),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(calculateTotalAndPaginateList(Location, input));

    return {
      ...(await runListQuery(query, input, (id) =>
        this.readOne(id, session, parentProp, parentResource, parentSensitivity)
      )),
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }
}
