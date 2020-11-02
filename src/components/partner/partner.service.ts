import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  InputException,
  NotFoundException,
  ServerException,
  Session,
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
  parsePropList,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { FinancialReportingType } from '../partnership/dto/financial-reporting-type';
import {
  CreatePartner,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  PartnerType,
  UpdatePartner,
} from './dto';
import { DbPartner } from './model';

@Injectable()
export class PartnerService {
  private readonly securedProperties = {
    organization: true,
    pointOfContact: true,
    types: true,
    financialReportingTypes: true,
    pmcEntityCode: true,
    globalInnovationsClient: true,
    active: true,
    address: true,
  };

  constructor(
    @Logger('partner:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
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

  async create(input: CreatePartner, session: Session): Promise<Partner> {
    this.verifyFinancialReportingType(
      input.financialReportingTypes,
      input.types
    );
    const partnerByOrgQ = this.db
      .query()
      .match([node('node', 'Organization', { id: input.organizationId })])
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
    const checkPartner = await partnerByOrgQ.first();
    if (checkPartner) {
      throw new DuplicateException(
        'partner.organizationId',
        'Partner for organization already exists.'
      );
    }

    const createdAt = DateTime.local();
    const secureProps = [
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'financialReportingTypes',
        value: input.financialReportingTypes,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'pmcEntityCode',
        value: input.pmcEntityCode,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'globalInnovationsClient',
        value: input.globalInnovationsClient,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'active',
        value: input.active,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'address',
        value: input.address,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'modifiedAt',
        value: createdAt,
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
      .call(createBaseNode, await generateId(), 'Partner', secureProps)
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

    const dbPartner = new DbPartner();
    await this.authorizationService.processNewBaseNode(
      dbPartner,
      result.id,
      session.userId
    );

    this.logger.debug(`partner created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOnePartnerByOrgId(id: string, session: Session): Promise<Partner> {
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

  async readOne(id: string, session: Session): Promise<Partner> {
    this.logger.debug(`Read Partner by Partner Id`, {
      id: id,
      userId: session.userId,
    });

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

    const props = parsePropList(result.propList);
    const secured = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      modifiedAt: props.modifiedAt,
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
      financialReportingTypes: {
        ...secured.financialReportingTypes,
        value: secured.financialReportingTypes.value || [],
      },
      canDelete: true, // TODO
    };
  }

  async update(input: UpdatePartner, session: Session): Promise<Partner> {
    const object = await this.readOne(input.id, session);
    let changes = {
      ...input,
      modifiedAt: DateTime.local(),
    };
    if (
      !this.validateFinancialReportingType(
        input.financialReportingTypes ?? object.financialReportingTypes.value,
        input.types ?? object.types.value
      )
    ) {
      if (input.financialReportingTypes && input.types) {
        throw new InputException(
          'Financial reporting type can only be applied to managing partners',
          'partnership.financialReportingType'
        );
      }
      changes = {
        ...changes,
        financialReportingTypes: [],
      };
    }

    await this.db.sgUpdateProperties({
      session,
      object,
      props: [
        'types',
        'financialReportingTypes',
        'pmcEntityCode',
        'globalInnovationsClient',
        'active',
        'address',
        'modifiedAt',
      ],
      changes: changes,
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

  async delete(id: string, session: Session): Promise<void> {
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
    session: Session
  ): Promise<PartnerListOutput> {
    const label = 'Partner';
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.userId && session.userId
          ? [
              relation('out', '', 'organization', { active: true }),
              node('', 'Organization'),
              relation('in', '', 'organization', { active: true }),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  protected verifyFinancialReportingType(
    financialReportingTypes: FinancialReportingType[] | undefined,
    types: PartnerType[] | undefined
  ) {
    if (!this.validateFinancialReportingType(financialReportingTypes, types)) {
      throw new InputException(
        'Financial reporting type can only be applied to managing partners',
        'partnership.financialReportingType'
      );
    }
  }

  protected validateFinancialReportingType(
    financialReportingTypes: FinancialReportingType[] | undefined,
    types: PartnerType[] | undefined
  ) {
    return financialReportingTypes?.length &&
      !types?.includes(PartnerType.Managing)
      ? false
      : true;
  }
}
