import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { SetRequired } from 'type-fest';
import { ID, Order, PublicOf, Session, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  INACTIVE,
  merge,
  requestingUser,
  sorting,
} from '~/core/database/query';
import { IProject, ProjectStep } from '../dto';
import {
  ExecuteProjectTransitionInput,
  ProjectWorkflowEvent as WorkflowEvent,
} from './dto';
import { ProjectWorkflowRepository } from './project-workflow.repository';

@Injectable()
export class ProjectWorkflowNeo4jRepository
  extends DtoRepository(WorkflowEvent)
  implements PublicOf<ProjectWorkflowRepository>
{
  // @ts-expect-error It doesn't have match base signature
  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'node.id': inArray(ids) })
      .apply(this.privileges.forUser(session).filterToReadable())
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async list(projectId: ID, session: Session) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'project.id': projectId })
      .match(requestingUser(session))
      .apply(this.privileges.forUser(session).filterToReadable())
      .apply(sorting(WorkflowEvent, { sort: 'createdAt', order: Order.ASC }))
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  protected matchEvent() {
    return (query: Query) =>
      query.match([
        node('node', this.resource.dbLabel),
        relation('in', '', ACTIVE),
        node('project', 'Project'),
      ]);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('out', undefined, 'who'),
          node('who', 'User'),
        ])
        .return<{ dto: UnsecuredDto<WorkflowEvent> }>(
          merge('node', {
            at: 'node.createdAt',
            who: 'who { .id }',
          }).as('dto'),
        );
  }

  async recordEvent(
    { project, ...props }: SetRequired<ExecuteProjectTransitionInput, 'step'>,
    session: Session,
  ) {
    const result = await this.db
      .query()
      .apply(
        await createNode(WorkflowEvent, {
          baseNodeProps: props,
        }),
      )
      .apply(
        createRelationships(WorkflowEvent, {
          in: { workflowEvent: ['Project', project] },
          out: { who: ['User', session.userId] },
        }),
      )
      .apply(this.hydrate())
      .first();
    const event = result!.dto;

    await this.db.updateProperties({
      type: IProject,
      object: { id: project },
      changes: { step: event.step, stepChangedAt: event.at },
      permanentAfter: null,
    });

    return event;
  }

  async mostRecentStep(
    projectId: ID<'Project'>,
    steps: readonly ProjectStep[],
  ) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Project', { id: projectId }),
        relation('out', '', 'step', INACTIVE),
        node('prop'),
      ])
      .where({ 'prop.value': inArray(steps) })
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .return<{ step: ProjectStep }>(`prop.value as step`)
      .first();
    return result?.step ?? null;
  }
}
