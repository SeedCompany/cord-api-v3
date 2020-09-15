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
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Partner) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.owningOrgId)',
    ];
  }

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

  async create(input: CreatePartner, session: ISession): Promise<Partner> {
    const createdAt = DateTime.local();
    // create partner
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ])
      .match([
        node('organization', 'Organization', {
          active: true,
          id: input.organizationId,
        }),
      ])
      .call(createBaseNode, 'Partner', [], {
        owningOrgId: session.owningOrgId,
      })
      .create([
        ...this.permission('organization', 'node'),
        ...this.permission('pointOfContact', 'node'),
      ])
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

    if (input.pointOfContactId) {
      await this.db
        .query()
        .matchNode('partner', 'Partner', {
          id: result.id,
          active: true,
        })
        .matchNode('pointOfContact', 'User', {
          id: input.pointOfContactId,
          active: true,
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
      .match([node('node', 'Partner', { active: true, id: id })])
      .call(matchPermList, 'requestingUser')
      .optionalMatch([
        node('node'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization', { active: true }),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'pointOfContact', { active: true }),
        node('pointOfContact', 'User', { active: true }),
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
        .matchNode('partner', 'Partner', { active: true, id: input.id })
        .matchNode('newPointOfContact', 'User', {
          id: input.pointOfContactId,
          active: true,
        })
        .optionalMatch([
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canReadPointOfContact', 'Permission', {
            property: 'pointOfContact',
            active: true,
            read: true,
          }),
          relation('out', '', 'baseNode', { active: true }),
          node('org'),
          relation('out', 'oldPointOfContactRel', 'pointOfContact', {
            active: true,
          }),
          node('pointOfContact', 'User', { active: true }),
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
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
