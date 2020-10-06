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
  CreatePartner,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  UpdatePartner,
} from './dto';
import { DbPartner } from './model';

@Injectable()
export class PartnerService {
  private readonly securedProperties = {
    organization: true,
    pointOfContact: true,
    types: true,
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
    const secureProps = [
      {
        key: 'types',
        value: input.types,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    // create partner
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('organization', 'Organization', {
          id: input.organizationId,
        }),
      ])
      .call(createBaseNode, 'Partner', secureProps)
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

    const dbPartner = new DbPartner();
    await this.authorizationService.addPermsForRole(
      InternalAdminRole,
      dbPartner,
      result.id,
      session.userId as string
    );

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

  async readOnePartnerByOrgId(id: string, session: ISession): Promise<Partner> {
    this.logger.debug(`Read Partner by Org Id`, {
      id: id,
      userId: session.userId,
    });
    const query = this.db

      .query()
      .match([node('node', 'Organization', { id: id })])
      .match([
        node('node'),
        relation('in', '', 'organization', { active: true }),
        node('partner', 'Partner'),
      ])
      .return({
        partner: [{ id: 'partnerId' }],
      })
      .asResult<{
        partnerId: string;
      }>();
    const result = await query.first();
    if (!result)
      throw new NotFoundException('No Partner Exists for this Org Id');

    return await this.readOne(result.partnerId, session);
  }

  async readOne(id: string, session: ISession): Promise<Partner> {
    this.logger.debug(`Read Partner by Partner Id`, {
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
      .call(matchPropList, 'permList')
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
      .return([
        'propList, permList, node',
        'organization.id as organizationId',
        'pointOfContact.id as pointOfContactId',
      ])
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
      result.propList,
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
      types: {
        ...secured.types,
        value: secured.types.value || [],
      },
    };
  }

  async update(input: UpdatePartner, session: ISession): Promise<Partner> {
    const object = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object,
      props: ['types'],
      changes: input,
      nodevar: 'partner',
    });
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
