import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  InputException,
  NotFoundException,
  Order,
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
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
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
        partnerId: ID;
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
      {
        key: 'canDelete',
        value: true,
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

  async readOnePartnerByOrgId(id: ID, session: Session): Promise<Partner> {
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
        partnerId: ID;
      }>();
    const result = await query.first();
    if (!result)
      throw new NotFoundException('No Partner Exists for this Org Id');

    return await this.readOne(result.partnerId, session);
  }

  async readOne(id: ID, session: Session): Promise<Partner> {
    this.logger.debug(`Read Partner by Partner Id`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Partner', { id: id })])
      .call(matchPropList)
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
        'propList, node',
        'organization.id as organizationId',
        'pointOfContact.id as pointOfContactId',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<Partner>> & {
          organizationId: ID;
          pointOfContactId: ID;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find partner', 'partner.id');
    }

    const props = parsePropList(result.propList);
    const secured = await this.authorizationService.secureProperties(
      Partner,
      props,
      session
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
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdatePartner, session: Session): Promise<Partner> {
    const object = await this.readOne(input.id, session);

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
      input = {
        ...input,
        financialReportingTypes: [],
      };
    }

    const changes = this.db.getActualChanges(Partner, object, input);
    await this.authorizationService.verifyCanEditChanges(
      Partner,
      object,
      changes
    );
    const { pointOfContactId, ...simpleChanges } = changes;

    await this.db.updateProperties({
      type: Partner,
      object,
      changes: simpleChanges,
    });

    if (pointOfContactId) {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .call(matchRequestingUser, session)
        .matchNode('partner', 'Partner', { id: input.id })
        .matchNode('newPointOfContact', 'User', {
          id: input.pointOfContactId,
        })
        .optionalMatch([
          node('org'),
          relation('out', 'oldPointOfContactRel', 'pointOfContact', {
            active: true,
          }),
          node('pointOfContact', 'User'),
        ])
        .setValues({
          'oldPointOfContactRel.active': false,
        })
        .with('*')
        .create([
          node('partner'),
          relation('out', '', 'pointOfContact', {
            active: true,
            createdAt,
          }),
          node('newPointOfContact'),
        ])
        .run();
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    if (!object) {
      throw new NotFoundException('Could not find Partner');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Partner'
      );

    try {
      await this.db.deleteNodeNew<Partner>({
        object,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
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
        calculateTotalAndPaginateList(
          Partner,
          input,
          this.orgNameSorter(input.sort, input.order)
        )
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  private readonly orgNameSorter = (sortInput: string, order: Order) => (
    q: Query
  ) => {
    // If the user inputs orgName as the sort value, then match the organization node for the sortValue match
    const orgProperties = ['name'];

    //The properties that are stored as strings
    const stringProperties = ['name'];
    const sortInputIsString = stringProperties.includes(sortInput);

    //if the sortInput, e.g. name, is a string type, check to see if a custom sortVal is given.  If not, coerse the default prop.value to lower case in the orderBy clause
    const sortValSecuredProp = sortInputIsString
      ? 'toLower(prop.value)'
      : 'prop.value';
    const sortValBaseNodeProp = sortInputIsString
      ? `toLower(node.${sortInput})`
      : `node.${sortInput}`;

    if (orgProperties.includes(sortInput)) {
      return q
        .match([
          node('node'),
          relation('out', '', 'organization', { active: true }),
          node('organization', 'Organization'),
        ])
        .with('*')
        .match([
          node('organization'),
          relation('out', '', sortInput, { active: true }),
          node('prop', 'Property'),
        ])
        .with('*')
        .orderBy(sortValSecuredProp, order);
    }
    return (Partner.SecuredProps as string[]).includes(sortInput)
      ? q
          .with('*')
          .match([
            node(node),
            relation('out', '', sortInput, { active: true }),
            node('prop', 'Property'),
          ])
          .with('*')
          .orderBy(sortValSecuredProp, order)
      : q.with('*').orderBy(sortValBaseNodeProp, order);
  };

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
