import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
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
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Role, rolesForScope } from '../../authorization/dto';
import { CreatePlanChange, PlanChange, UpdatePlanChange } from './dto';
import { ChangeListInput, ChangeListOutput } from './dto/change-list.dto';

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

    const createPlanChange = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(createBaseNode, planChangeId, 'PlanChange', secureProps)
      .return('node.id as id');

    const result = await createPlanChange.first();
    if (!result) {
      throw new ServerException('failed to create plan change');
    }

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

    return await this.readOne(planChangeId, session);
  }

  async readOne(id: ID, session: Session): Promise<PlanChange> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'PlanChange', { id })])
      .call(matchPropList)
      .optionalMatch([
        node('project', 'Project'),
        relation('out', '', 'planChange', { active: true }),
        node('change', 'PlanChange', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .call(matchMemberRoles, session.userId)
      .return('node, propList, memberRoles')
      .asResult<
        StandardReadResult<DbPropsOfDto<PlanChange>> & {
          memberRoles: Role[];
        }
      >();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find plan change',
        'planChange.id'
      );
    }

    const parsedProps = parsePropList(result.propList);

    const securedProps = await this.authorizationService.secureProperties(
      PlanChange,
      parsedProps,
      session,
      result.memberRoles.flat().map(rolesForScope('project'))
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdatePlanChange, session: Session): Promise<PlanChange> {
    const object = await this.readOne(input.id, session);

    await this.db.updateProperties({
      session,
      object,
      props: ['types', 'summary', 'status'],
      changes: input,
      nodevar: 'planChange',
    });
    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find plan change',
        'planChange.id'
      );
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this plan change'
      );

    try {
      await this.db.deleteNode({
        object,
      });
    } catch (exception) {
      this.logger.warning('Failed to delete plan change', {
        exception,
      });
      throw new ServerException('Failed to delete plan change');
    }
  }

  async list(
    { filter, ...input }: ChangeListInput,
    session: Session
  ): Promise<ChangeListOutput> {
    // const label = 'PlanChange';

    const query = this.db
      .query()
      .match([
        // requestingUser(session),
        // ...permissionsOfNode(label),
        node('node'),
        ...(filter.projectId
          ? [
              relation('in', '', 'planChange', { active: true }),
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
}
