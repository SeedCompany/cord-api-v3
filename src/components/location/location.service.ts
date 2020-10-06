import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
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
import { InternalAdminRole } from '../authorization/roles';
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
    iso31663: true,
    type: true,
    sensitivity: true,
  };

  constructor(
    @Logger('location:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
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

      // ISO-3166-3 NODE
      'CREATE CONSTRAINT ON (n:Iso31663) ASSERT n.value IS UNIQUE',
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
        key: 'iso31663',
        value: input.iso31663,
        isPublic: false,
        isOrgPublic: false,
        label: 'Iso31663',
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
      .call(createBaseNode, 'Location', secureProps)
      .return('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create location');
    }

    const dbLocation = new DbLocation();
    await this.authorizationService.addPermsForRole2(
      InternalAdminRole,
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
    };
  }

  async update(input: UpdateLocation, session: ISession): Promise<Location> {
    const location = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object: location,
      props: ['name', 'iso31663', 'type', 'sensitivity'],
      changes: input,
      nodevar: 'location',
    });

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
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property'),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
