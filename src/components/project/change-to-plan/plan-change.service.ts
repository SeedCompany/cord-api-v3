import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../../common';
import {
  ConfigService,
  DatabaseService,
  IEventBus,
  ILogger,
  Logger,
  OnIndex,
} from '../../../core';
import { runListQuery } from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { ProjectStatus } from '../dto';
import { ProjectService } from '../project.service';
import { CreatePlanChange, PlanChange, UpdatePlanChange } from './dto';
import { ChangeListInput, ChangeListOutput } from './dto/change-list.dto';
import { PlanChangeUpdatedEvent } from './events';
import { PlanChangeRepository } from './plan-change.repository';

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
    private readonly authorizationService: AuthorizationService,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly repo: PlanChangeRepository
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
    // Project status should be active
    const project = await this.projectService.readOne(projectId, session);
    if (project.status !== ProjectStatus.Active) {
      throw new InputException(
        'Project status should be Active',
        'project.status'
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

    const result = await this.repo.create(session, secureProps);
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

    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<PlanChange> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException(
        'Could not find plan change',
        'planChange.id'
      );
    }

    const securedProps = await this.authorizationService.secureProperties(
      PlanChange,
      result.props,
      session,
      result.scopedRoles
    );

    return {
      ...result.props,
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdatePlanChange, session: Session): Promise<PlanChange> {
    const object = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(object, input);

    await this.db.updateProperties({
      type: PlanChange,
      object,
      changes,
    });
    const updated = await this.readOne(input.id, session);

    const planChangeUpdatedEvent = new PlanChangeUpdatedEvent(
      updated,
      object,
      input,
      session
    );
    await this.eventBus.publish(planChangeUpdatedEvent);

    return updated;
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
      await this.db.deleteNode(object);
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
    const query = this.repo.list({ filter, ...input }, session);
    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
