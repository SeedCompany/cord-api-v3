import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  InputException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  getPermList,
  getPropList,
  IEventBus,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
} from '../../core';
import {
  calculateTotalAndPaginateList,
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
import { FileService } from '../file';
import { PartnerService, PartnerType } from '../partner';
import { ProjectService } from '../project';
import {
  CreatePartnership,
  FinancialReportingType,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipListInput,
  PartnershipListOutput,
  UpdatePartnership,
} from './dto';
import {
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipWillDeleteEvent,
} from './events';
import { DbPartnership } from './model';

@Injectable()
export class PartnershipService {
  private readonly securedProperties = {
    agreementStatus: true,
    mouStatus: true,
    mouStart: true,
    mouEnd: true,
    mouStartOverride: true,
    mouEndOverride: true,
    types: true,
    financialReportingType: true,
    mou: true,
    agreement: true,
    partner: true,
  };

  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly partnerService: PartnerService,
    private readonly eventBus: IEventBus,
    private readonly authorizationService: AuthorizationService,
    @Logger('partnership:service') private readonly logger: ILogger
  ) {}

  async create(
    { partnerId, projectId, ...input }: CreatePartnership,
    session: ISession
  ): Promise<Partnership> {
    const createdAt = DateTime.local();

    try {
      await this.partnerService.readOne(partnerId, session);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e.withField('partnership.partnerId');
      }
      throw e;
    }

    try {
      await this.projectService.readOne(projectId, session);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e.withField('partnership.projectId');
      }
      throw e;
    }

    if (await this.getPartnershipByProjectAndPartner(projectId, partnerId)) {
      throw new DuplicateException(
        'partnership.projectId',
        'Partnership for this project and partner already exists'
      );
    }

    this.verifyFinancialReportingType(
      input.financialReportingType,
      input.types
    );

    // financialReportingType should be subset of its Partner's financialReportingTypes
    const partner = await this.partnerService.readOne(partnerId, session);
    this.assertFinancialReportingType(
      input.financialReportingType,
      partner.financialReportingTypes.value
    );

    const mou = await this.files.createDefinedFile(
      `MOU`,
      session,
      input.mou,
      'partnership.mou'
    );
    const agreement = await this.files.createDefinedFile(
      `Partner Agreement`,
      session,
      input.agreement,
      'partnership.agreement'
    );

    const secureProps = [
      {
        key: 'agreementStatus',
        value: input.agreementStatus || PartnershipAgreementStatus.NotAttached,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'agreement',
        value: agreement,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mou',
        value: mou,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouStatus',
        value: input.mouStatus || PartnershipAgreementStatus.NotAttached,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouStartOverride',
        value: input.mouStartOverride,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouEndOverride',
        value: input.mouEndOverride,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'financialReportingType',
        value: input.financialReportingType,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    let result;
    try {
      const createPartnership = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(
          createBaseNode,
          'Partnership',
          secureProps,
          {},
          [],
          session.userId === this.config.rootAdmin.id
        )
        .return('node.id as id');

      try {
        result = await createPartnership.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }

      if (!result) {
        throw new ServerException('failed to create partnership');
      }

      const dbPartnership = new DbPartnership();
      await this.authorizationService.processNewBaseNode(
        dbPartnership,
        result.id,
        session.userId as string
      );

      // connect the Partner to the Partnership
      // and connect Partnership to Project
      await this.db
        .query()
        .match([
          [
            node('partner', 'Partner', {
              id: partnerId,
            }),
          ],
          [
            node('partnership', 'Partnership', {
              id: result.id,
            }),
          ],
          [node('project', 'Project', { id: projectId })],
        ])
        .create([
          node('project'),
          relation('out', '', 'partnership', { active: true, createdAt }),
          node('partnership'),
          relation('out', '', 'partner', { active: true, createdAt }),
          node('partner'),
        ])
        .return('partnership.id as id')
        .first();

      const partnership = await this.readOne(result.id, session);

      await this.eventBus.publish(
        new PartnershipCreatedEvent(partnership, session)
      );

      return partnership;
    } catch (exception) {
      this.logger.warning('Failed to create partnership', {
        exception,
      });

      throw new ServerException('Failed to create partnership', exception);
    }
  }

  async readOne(id: string, session: ISession): Promise<Partnership> {
    this.logger.debug('readOne', { id, userId: session.userId });

    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Partnership', { id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .match([
        node('node'),
        relation('in', '', 'partnership'),
        node('project', 'Project'),
      ])
      .match([
        node('node'),
        relation('out', '', 'partner'),
        node('partner', 'Partner'),
      ])
      .return(
        'propList, permList, node, project.id as projectId, partner.id as partnerId'
      )
      .asResult<
        StandardReadResult<DbPropsOfDto<Partnership>> & {
          projectId: string;
          partnerId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'could not find Partnership',
        'partnership.id'
      );
    }

    const readProject = await this.projectService.readOne(
      result.projectId,
      session
    );

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );
    const canReadMouStart =
      readProject.mouStart.canRead && securedProps.mouStartOverride.canRead;
    const canReadMouEnd =
      readProject.mouEnd.canRead && securedProps.mouEndOverride.canRead;

    const mouStart = canReadMouStart
      ? securedProps.mouStartOverride.value ?? readProject.mouStart.value
      : null;
    const mouEnd = canReadMouEnd
      ? securedProps.mouEndOverride.value ?? readProject.mouEnd.value
      : null;

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      mouStart: {
        value: mouStart,
        canRead: canReadMouStart,
        canEdit: false, // edit the project mou or edit the partnerhsip mou override
      },
      mouEnd: {
        value: mouEnd,
        canRead: canReadMouEnd,
        canEdit: false, // edit the project mou or edit the partnerhsip mou override
      },
      types: {
        ...securedProps.types,
        value: securedProps.types.value || [],
      },
      partner: {
        ...securedProps.partner,
        value: result.partnerId,
      },
    };
  }

  async update(input: UpdatePartnership, session: ISession) {
    // mou start and end are now computed fields and do not get updated directly
    const object = await this.readOne(input.id, session);
    let changes = input;

    // financialReportingType should be subset of its Partner's financialReportingTypes
    const partner = await this.partnerService.readOne(
      object.partner.value as string,
      session
    );
    this.assertFinancialReportingType(
      input.financialReportingType,
      partner.financialReportingTypes.value
    );

    if (
      !this.validateFinancialReportingType(
        input.financialReportingType ?? object.financialReportingType.value,
        input.types ?? object.types.value
      )
    ) {
      if (input.financialReportingType && input.types) {
        throw new InputException(
          'Funding type can only be applied to managing partners',
          'partnership.financialReportingType'
        );
      }
      changes = {
        ...changes,
        financialReportingType: null,
      };
    }

    const { mou, agreement, ...rest } = changes;
    await this.db.sgUpdateProperties({
      session,
      object,
      props: [
        'agreementStatus',
        'mouStatus',
        'types',
        'financialReportingType',
        'mouStartOverride',
        'mouEndOverride',
      ],
      changes: rest,
      nodevar: 'partnership',
    });
    await this.files.updateDefinedFile(
      object.mou,
      'partnership.mou',
      mou,
      session
    );
    await this.files.updateDefinedFile(
      object.agreement,
      'partnership.agreement',
      agreement,
      session
    );

    const partnership = await this.readOne(input.id, session);
    await this.eventBus.publish(
      new PartnershipUpdatedEvent(partnership, input, session)
    );
    return partnership;
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find partnership',
        'partnership.id'
      );
    }

    await this.eventBus.publish(
      new PartnershipWillDeleteEvent(object, session)
    );

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.warning('Failed to delete partnership', {
        exception,
      });

      throw new ServerException('Failed to delete partnership', exception);
    }
  }

  async list(
    input: Partial<PartnershipListInput>,
    session: ISession
  ): Promise<PartnershipListOutput> {
    const { filter, ...listInput } = {
      ...PartnershipListInput.defaultVal,
      ...input,
    };

    const label = 'Partnership';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'partnership', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList, listInput, (q, sort, order) =>
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

    return await runListQuery(query, listInput, (id) =>
      this.readOne(id, session)
    );
  }

  async checkPartnershipConsistency(session: ISession): Promise<boolean> {
    const partnerships = await this.db
      .query()
      .match([matchSession(session), [node('partnership', 'Partnership')]])
      .return('partnership.id as id')
      .run();

    return (
      (
        await Promise.all(
          partnerships.map(async (partnership) => {
            return await this.db.hasProperties({
              session,
              id: partnership.id,
              props: [
                'agreementStatus',
                'mouStatus',
                'mouStart',
                'mouEnd',
                'types',
              ],
              nodevar: 'partnership',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          partnerships.map(async (partnership) => {
            return await this.db.isUniqueProperties({
              session,
              id: partnership.id,
              props: [
                'agreementStatus',
                'mouStatus',
                'mouStart',
                'mouEnd',
                'types',
              ],
              nodevar: 'partnership',
            });
          })
        )
      ).every((n) => n)
    );
  }

  protected filterByProject(
    query: Query,
    projectId: string,
    relationshipType: string,
    relationshipDirection: RelationDirection,
    label: string
  ) {
    query.match([
      node('project', 'Project', { id: projectId }),
      relation(relationshipDirection, '', relationshipType, { active: true }),
      node('node', label),
    ]);
  }

  protected verifyFinancialReportingType(
    financialReportingType: FinancialReportingType | null | undefined,
    types: PartnerType[] | undefined
  ) {
    if (!this.validateFinancialReportingType(financialReportingType, types)) {
      throw new InputException(
        'Funding type can only be applied to managing partners',
        'partnership.financialReportingType'
      );
    }
  }

  protected validateFinancialReportingType(
    financialReportingType: FinancialReportingType | null | undefined,
    types: PartnerType[] | undefined
  ) {
    return financialReportingType && !types?.includes(PartnerType.Managing)
      ? false
      : true;
  }

  protected assertFinancialReportingType(
    type: FinancialReportingType | null | undefined,
    availableTypes: FinancialReportingType[] | undefined
  ) {
    if (!type) {
      return;
    }
    if (!availableTypes?.includes(type)) {
      throw new InputException(
        `FinancialReportingType ${type} cannot be assigned to this partnership`,
        'input.financialReportingType'
      );
    }
  }

  protected async getPartnershipByProjectAndPartner(
    projectId: string,
    partnerId: string
  ): Promise<boolean> {
    const result = await this.db
      .query()
      .match([node('partner', 'Partner', { id: partnerId })])
      .match([node('project', 'Project', { id: projectId })])
      .match([
        node('project'),
        relation('out', '', 'partnership'),
        node('partnership'),
        relation('out', '', 'partner'),
        node('partner'),
      ])
      .return('partnership.id as id')
      .first();

    return result ? true : false;
  }
}
