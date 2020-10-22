import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ISession,
  NotFoundException,
  Sensitivity,
  ServerException,
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
  defaultSorter,
  matchPermList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateLocation,
  Location,
  LocationListInput,
  LocationListOutput,
  UpdateLocation,
} from './dto';
import { DbLocation } from './model';

@Injectable()
export class LocationService {
  private readonly securedProperties = {
    name: true,
    fundingAccount: true,
    isoAlpha3: true,
    type: true,
    sensitivity: true,
  };

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

  async create(input: CreateLocation, session: ISession): Promise<Location> {
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
        key: 'sensitivity',
        value: input.sensitivity,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create location
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(createBaseNode, await generateId(), 'Location', secureProps)
      .return('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create location');
    }

    const dbLocation = new DbLocation();
    await this.authorizationService.processNewBaseNode(
      dbLocation,
      result.id,
      session.userId as string
    );

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

    this.logger.debug(`location created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: string, session: ISession): Promise<Location> {
    this.logger.debug(`Read Location`, {
      id: id,
      userId: session.userId,
    });

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Location', { id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'fundingAccount', { active: true }),
        node('fundingAccount', 'FundingAccount'),
      ])
      .return('propList, permList, node, fundingAccount.id as fundingAccountId')
      .asResult<
        StandardReadResult<DbPropsOfDto<Location>> & {
          fundingAccountId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find location', 'location.id');
    }

    const secured = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      fundingAccount: {
        ...secured.fundingAccount,
        value: result.fundingAccountId,
      },
      sensitivity: secured.sensitivity.value || Sensitivity.High,
      canDelete: true, // TODO
    };
  }

  async update(input: UpdateLocation, session: ISession): Promise<Location> {
    const location = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object: location,
      props: ['name', 'isoAlpha3', 'type', 'sensitivity'],
      changes: input,
      nodevar: 'location',
    });

    // Update partner
    if (input.fundingAccountId) {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .call(matchRequestingUser, session)
        .matchNode('location', 'Location', { id: input.id })
        .matchNode('newFundingAccount', 'FundingAccount', {
          id: input.fundingAccountId,
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

    return await this.readOne(input.id, session);
  }

  async delete(_id: string, _session: ISession): Promise<void> {
    // Not Implemented
  }

  async list(
    { filter, ...input }: LocationListInput,
    session: ISession
  ): Promise<LocationListOutput> {
    const label = 'Location';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
