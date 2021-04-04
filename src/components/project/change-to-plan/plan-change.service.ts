import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
} from '../../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Role } from '../../authorization/dto';
import {
  CreatePlanChange,
  PlanChange,
  PlanChangeListInput,
  PlanChangeListOutput,
  UpdatePlanChange,
} from './dto';

@Injectable()
export class PlanChangeService {
  private readonly securedProperties = {
    types: true,
    summary: true,
    status: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('project:plan-change:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:PlanChange) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:PlanChange) ASSERT n.id IS UNIQUE',
    ];
  }

  async create(
    { projectId, ...input }: CreatePlanChange,
    session: Session
  ): Promise<PlanChange> {
    const createdAt = DateTime.local();
    const planChangeId = await generateId();

    const secureProps = [
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'summary',
        value: input.summary,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'status',
        value: input.status,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    let result;
    try {
      const createPlanChange = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, planChangeId, 'PlanChange', secureProps)
        .return('node.id as id');

      try {
        result = await createPlanChange.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }

      if (!result) {
        throw new ServerException('failed to create planChange');
      }

      // connect PlanChange to Project
      await this.db
        .query()
        .match([
          [node('planChange', 'PlanChange', { id: result.id })],
          [node('project', 'Project', { id: projectId })],
        ])
        .create([
          node('project'),
          relation('out', '', 'planChange', { active: true, createdAt }),
          node('planChange'),
        ])
        .return('planChange.id as id')
        .first();

      // await this.authorizationService.processNewBaseNode(
      //   new DbPlanChange(),
      //   result.id,
      //   session.userId
      // );

      const planChange = await this.readOne(planChangeId, session);

      // await this.eventBus.publish(
      //   new PartnershipCreatedEvent(partnership, session)
      // );

      return planChange;
    } catch (exception) {
      this.logger.warning('Failed to create planChange', {
        exception,
      });

      throw new ServerException('Failed to create planChange', exception);
    }
  }

  async readOne(id: string, session: Session): Promise<PlanChange> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No plan change id to search for',
        'planChange.id'
      );
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'PlanChange', { id })])
      .call(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'planChange', { active: true }),
        node('', 'PlanChange', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .call(matchMemberRoles, session.userId)
      .return('node, propList, memberRoles')
      .asResult<
        StandardReadResult<DbPropsOfDto<PlanChange>> & {
          memberRoles: Role[][];
        }
      >();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find plan change',
        'planChange.id'
      );
    }

    const props = parsePropList(result.propList);

    // const securedProps = await this.authorizationService.secureProperties(
    //   PlanChange,
    //   props,
    //   session,
    //   result.memberRoles.flat().map(rolesForScope('project'))
    // );

    return {
      ...parseBaseNodeProperties(result.node),
      types: {
        value: props.types ?? [],
        canEdit: false,
        canRead: false,
      },
      summary: {
        value: props.summary,
        canEdit: false,
        canRead: false,
      },
      status: {
        value: props.status,
        canEdit: false,
        canRead: false,
      },
      canDelete: await this.db.checkDeletePermission(id, session), // TODO
    };
  }

  async list(
    { filter, ...input }: PlanChangeListInput,
    session: Session
  ): Promise<PlanChangeListOutput> {
    const label = 'PlanChange';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'planChange'),
              node('project', 'Project', {
                id: filter.projectId,
              }),
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

  async update(input: UpdatePlanChange, session: Session): Promise<PlanChange> {
    const object = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object,
      props: ['types', 'summary', 'status'],
      changes: {
        ...input,
      },
      nodevar: 'planChange',
    });
    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find plan change',
        'planChange.id'
      );
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.warning('Failed to delete plan change', {
        exception,
      });

      throw new ServerException('Failed to delete plan change', exception);
    }
  }
}
