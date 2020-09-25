import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ISession,
  NotFoundException,
  ServerException,
  UnauthenticatedException,
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
import { InternalRole } from '../authorization/dto';
import {
  CreatePartner,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  UpdatePartner,
} from './dto';

@Injectable()
export class PartnerService {
  private readonly securedProperties = {
    organization: true,
    pointOfContact: true,
  };

  constructor(
    @Logger('partner:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Partner) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.createdAt)',
    ];
  }

  async create(input: CreatePartner, session: ISession): Promise<Partner> {
    const createdAt = DateTime.local();
    // create partner
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('organization', 'Organization', {
          id: input.organizationId,
        }),
      ])
      .call(createBaseNode, 'Partner', [])
      .create([
        node('node'),
        relation('out', '', 'organization', { active: true, createdAt }),
        node('organization'),
      ])
      .return('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create partner');
    }

    await this.authorizationService.addPermsForRole({
      userId: session.userId as string,
      baseNodeId: result.id,
      role: InternalRole.Admin,
    });

    if (input.pointOfContactId) {
      await this.db
        .query()
        .matchNode('partner', 'Partner', {
          id: result.id,
        })
        .matchNode('pointOfContact', 'User', {
          id: input.pointOfContactId,
        })
        .create([
          node('partner'),
          relation('out', '', 'pointOfContact', {
            active: true,
            createdAt,
          }),
          node('pointOfContact'),
        ])
        .run();
    }

    this.logger.debug(`partner created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: string, session: ISession): Promise<Partner> {
    this.logger.debug(`Read Partner`, {
      id: id,
      userId: session.userId,
    });

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Partner', { id: id })])
      .call(matchPermList, 'requestingUser')
      .optionalMatch([
        node('node'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'pointOfContact', { active: true }),
        node('pointOfContact', 'User'),
      ])
      .return(
        'permList, node, organization.id as organizationId, pointOfContact.id as pointOfContactId'
      )
      .asResult<
        StandardReadResult<DbPropsOfDto<Partner>> & {
          organizationId: string;
          pointOfContactId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find partner', 'partner.id');
    }

    const secured = parseSecuredProperties(
      [],
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      organization: {
        ...secured.organization,
        value: result.organizationId,
      },
      pointOfContact: {
        ...secured.pointOfContact,
        value: result.pointOfContactId,
      },
    };
  }

  async update(input: UpdatePartner, session: ISession): Promise<Partner> {
    // Update partner
    if (input.pointOfContactId) {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .call(matchRequestingUser, session)
        .matchNode('partner', 'Partner', { id: input.id })
        .matchNode('newPointOfContact', 'User', {
          id: input.pointOfContactId,
        })
        .optionalMatch([
          node('requestingUser'),
          relation('in', '', 'member'),
          node('', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node('canReadPointOfContact', 'Permission', {
            property: 'pointOfContact',

            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('org'),
          relation('out', 'oldPointOfContactRel', 'pointOfContact', {
            active: true,
          }),
          node('pointOfContact', 'User'),
        ])
        .create([
          node('partner'),
          relation('out', '', 'pointOfContact', {
            active: true,
            createdAt,
          }),
          node('newPointOfContact'),
        ])
        .delete('oldPointOfContactRel')
        .run();
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }
    const ed = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: ed,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.debug(`deleted partner with id`, { id });
  }

  async list(
    { filter, ...input }: PartnerListInput,
    session: ISession
  ): Promise<PartnerListOutput> {
    const label = 'Partner';
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
