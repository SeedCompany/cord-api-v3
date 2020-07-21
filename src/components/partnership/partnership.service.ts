import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
  UnauthorizedException,
} from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { flatMap, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { fiscalYears, ISession } from '../../common';
import {
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addShapeForBaseNodeMetaProperty,
  addShapeForChildBaseNodeMetaProperty,
  ChildBaseNodeMetaProperty,
  ConfigService,
  DatabaseService,
  IEventBus,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
} from '../../core';
import { BudgetService } from '../budget';
import { FileService } from '../file';
import { OrganizationService } from '../organization';
import { ProjectService } from '../project/project.service';
import {
  CreatePartnership,
  Partnership,
  PartnershipListInput,
  PartnershipListOutput,
  PartnershipType,
  UpdatePartnership,
} from './dto';
import {
  PartnershipCreatedEvent,
  PartnershipDeletedEvent,
  PartnershipUpdatedEvent,
} from './events';

@Injectable()
export class PartnershipService {
  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly budgetService: BudgetService,
    private readonly orgService: OrganizationService,
    private readonly projectService: ProjectService,
    private readonly eventBus: IEventBus,
    @Logger('partnership:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    if (!value) {
      value = null;
    }
    const createdAt = DateTime.local();
    const propLabel = 'Property';
    return [
      [
        node('newPartnership'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
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
        node('newPartnership'),
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
        node('newPartnership'),
      ],
    ];
  };

  propMatch = (query: Query, property: string) => {
    const readPerm = 'canRead' + upperFirst(property);
    const editPerm = 'canEdit' + upperFirst(property);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(editPerm, 'Permission', {
          property,
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(readPerm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
  };

  async create(
    { organizationId, projectId, ...input }: CreatePartnership,
    session: ISession
  ): Promise<Partnership> {
    const id = generate();
    const createdAt = DateTime.local();

    if (!(await this.orgService.readOne(organizationId, session))) {
      throw new UnauthorizedException('organization does not exist');
    }

    if (!(await this.projectService.readOne(projectId, session))) {
      throw new UnauthorizedException('project does not exist');
    }

    try {
      const mou = await this.files.createDefinedFile(`MOU`, session, input.mou);
      const agreement = await this.files.createDefinedFile(
        `Partner Agreement`,
        session,
        input.agreement
      );

      const createPartnership = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreatePartnership' }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newPartnership', 'Partnership', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('agreementStatus', input.agreementStatus),
          ...this.property('agreement', agreement),
          ...this.property('mou', mou),
          ...this.property('mouStatus', input.mouStatus),
          ...this.property('mouStartOverride', input.mouStartOverride),
          ...this.property('mouEndOverride', input.mouEndOverride),
          ...this.property('types', input.types),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: `partnership ${id} admin`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: `partnership ${id} users`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('agreementStatus'),
          ...this.permission('mouStatus'),
          ...this.permission('types'),
          ...this.permission('organization'),
          ...this.permission('mouStartOverride'),
          ...this.permission('mouEndOverride'),
        ])
        .return('newPartnership.id as id');

      try {
        await createPartnership.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }

      // connect the Organization to the Partnership
      // and connect Partnership to Project
      const query = `
        MATCH (organization:Organization {id: $organizationId, active: true}),
          (partnership:Partnership {id: $id, active: true}),
          (project:Project {id: $projectId, active: true})
        CREATE (project)-[:partnership {active: true, createdAt: datetime()}]->(partnership)
                  -[:organization {active: true, createdAt: datetime()}]->(organization)
        RETURN partnership.id as id
      `;
      await this.db
        .query()
        .raw(query, {
          organizationId,
          id,
          projectId,
        })
        .first();

      const partnership = await this.readOne(id, session);
      await this.eventBus.publish(
        new PartnershipCreatedEvent(partnership, session)
      );

      // TODO move to event handler
      const fiscalRange = fiscalYears(
        partnership.mouStart.value,
        partnership.mouEnd.value
      ); // calculate the fiscalYears covered by this date range
      if (
        input.types?.includes(PartnershipType.Funding) &&
        fiscalRange.length > 0
      ) {
        const budget = await this.budgetService.create({ projectId }, session);

        const inputRecords = flatMap(fiscalRange, (fiscalYear) => ({
          budgetId: budget.id,
          organizationId,
          fiscalYear,
        }));

        await Promise.all(
          inputRecords.map((record) =>
            this.budgetService.createRecord(record, session)
          )
        );
      }

      return partnership;
    } catch (e) {
      this.logger.warning('Failed to create partnership', {
        exception: e,
      });

      throw new ServerException('Failed to create partnership');
    }
  }

  async readOne(id: string, session: ISession): Promise<Partnership> {
    this.logger.debug('readOne', { id, userId: session.userId });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const props = [
      'agreementStatus',
      'mouStatus',
      'mouStart',
      'mouEnd',
      'mouStartOverride',
      'mouEndOverride',
      'types',
      'mou',
      'agreement',
    ];

    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'organization',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Organization',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'organizationId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Partnership', id)
      .call(addAllSecureProperties, ...props)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
        'node',
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
        'labels(node) as labels',
      ]);

    let result;
    try {
      result = await query.first();
    } catch (error) {
      this.logger.error('could not read partnership', error);
    }
    if (!result || !result.id) {
      throw new NotFoundException('could not find Partnership');
    }

    let mouStart = null;
    let mouEnd = null;

    // if user has access to project mou and there is no partnership override
    if (result.mouStart.canRead || result.mouStartOverride.canRead) {
      mouStart = result.mouStartOverride.value ?? result.mouStart.value;
    }
    if (result.mouEnd.canRead || result.mouEndOverride.canRead) {
      mouEnd = result.mouEndOverride.value ?? result.mouEnd.value;
    }

    const canReadMouStart =
      result.mouStart.canRead || result.mouStartOverride.canRead;
    const canReadMouEnd =
      result.mouEnd.canRead || result.mouEndOverride.canRead;

    const response: any = {
      ...result,
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
      organization: this.orgService.readOne(result.organizationId, session),
    };

    return (response as unknown) as Partnership;
  }

  async update(input: UpdatePartnership, session: ISession) {
    // mou start and end are now computed fields and do not get updated directly
    const object = await this.readOne(input.id, session);

    const { mou, agreement, ...rest } = input;
    await this.db.sgUpdateProperties({
      session,
      object,
      props: [
        'agreementStatus',
        'mouStatus',
        'types',
        'mouStartOverride',
        'mouEndOverride',
      ],
      changes: rest,
      nodevar: 'partnership',
    });
    await this.files.updateDefinedFile(object.mou, mou, session);
    await this.files.updateDefinedFile(object.agreement, agreement, session);

    const partnership = await this.readOne(input.id, session);
    await this.eventBus.publish(
      new PartnershipUpdatedEvent(partnership, input, session)
    );
    return partnership;
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find partnership');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete partnership', {
        exception: e,
      });

      throw new ServerException('Failed to delete partnership');
    }

    await this.eventBus.publish(new PartnershipDeletedEvent(object, session));
  }

  async list(
    input: Partial<PartnershipListInput>,
    session: ISession
  ): Promise<PartnershipListOutput> {
    const { page, count, sort, order, filter } = {
      ...PartnershipListInput.defaultVal,
      ...input,
    };

    const { projectId } = filter;
    let result: {
      items: Partnership[];
      hasMore: boolean;
      total: number;
    } = { items: [], hasMore: false, total: 0 };

    if (projectId) {
      const query = `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (requestingUser:User {
              active: true,
              id: $requestingUserId
          }),
          (project:Project {id: $projectId, active: true, owningOrgId: $owningOrgId})
        -[:partnership]->(partnership:Partnership {active:true})
        WITH COUNT(partnership) as total
        
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (requestingUser:User {
              active: true,
              id: $requestingUserId
          }),
          (project:Project {id: $projectId, active: true, owningOrgId: $owningOrgId})
        -[:partnership]->(partnership:Partnership {active:true})
        WITH total, project, partnership
        OPTIONAL MATCH (requestingUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]
        ->(canEditAgreementStatus:Permission { property: 'agreementStatus', active: true, edit: true })
        -[:baseNode { active: true }]->(partnership)-[:agreementStatus { active: true }]->(agreementStatus:Property { active: true })
        OPTIONAL MATCH (requestingUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]
        ->(canReadAgreementStatus:Permission { property: 'agreementStatus', active: true, read: true })
        -[:baseNode { active: true }]->(partnership)-[:agreementStatus { active: true }]->(agreementStatus:Property { active: true })
        RETURN DISTINCT total, partnership.id as id, agreementStatus.value as agreementStatus, partnership.createdAt as createdAt
        ORDER BY ${sort} ${order}
        SKIP $skip LIMIT $count
      `;

      const projectPartners = await this.db
        .query()
        .raw(query, {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          projectId,
          skip: (page - 1) * count,
          count,
        })
        .run();

      result.total = projectPartners[0]?.total || 0;
      result.hasMore = count * page < result.total ?? true;

      result.items = await Promise.all(
        projectPartners.map(async (partnership) =>
          this.readOne(partnership.id, session)
        )
      );
    } else {
      result = await this.db.list<Partnership>({
        session,
        nodevar: 'partnership',
        aclReadProp: 'canReadPartnerships',
        aclEditProp: 'canCreatePartnership',
        props: [
          { name: 'agreementStatus', secure: true },
          { name: 'mou', secure: true },
          { name: 'agreement', secure: true },
          { name: 'mouStatus', secure: true },
          { name: 'mouStart', secure: true },
          { name: 'mouEnd', secure: true },
          { name: 'mouStartOverride', secure: true },
          { name: 'mouEndOverride', secure: true },
          { name: 'organization', secure: false },
          { name: 'types', secure: true, list: true },
        ],
        input: {
          page,
          count,
          sort,
          order,
          filter,
        },
      });

      const items = await Promise.all(
        result.items.map(async (item) => {
          const query = `
              MATCH (partnership:Partnership {id: $id, active: true})
                -[:organization {active: true}]->(organization)
              RETURN organization.id as id
            `;
          const orgId = await this.db
            .query()
            .raw(query, {
              id: item.id,
            })
            .first();

          const org = await this.orgService.readOne(orgId?.id, session);
          return {
            ...item,
            organization: org,
          };
        })
      );
      result.items = items;
    }

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async checkPartnershipConsistency(session: ISession): Promise<boolean> {
    const partnerships = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('partnership', 'Partnership', {
            active: true,
          }),
        ],
      ])
      .return('partnership.id as id')
      .run();

    return (
      (
        await Promise.all(
          partnerships.map(async (partnership) => {
            return this.db.hasProperties({
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
            return this.db.isUniqueProperties({
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
}
