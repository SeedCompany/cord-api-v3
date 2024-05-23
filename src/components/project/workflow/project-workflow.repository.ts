import { Injectable } from '@nestjs/common';
import { SetRequired } from 'type-fest';
import { ID, Session } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { ExecuteProjectTransitionInput, ProjectWorkflowEvent } from './dto';

@Injectable()
export class ProjectWorkflowRepository extends RepoFor(ProjectWorkflowEvent, {
  hydrate: (event) => ({
    id: true,
    who: true,
    at: true,
    transition: event.transitionKey,
    step: true,
    notes: true,
  }),
  omit: ['list', 'create', 'update', 'delete', 'readMany'],
}) {
  async readMany(ids: readonly ID[], _session: Session) {
    return await this.defaults.readMany(ids);
  }

  async list(projectId: ID, _session: Session) {
    const project = e.cast(e.Project, e.uuid(projectId));
    const query = e.select(project.workflowEvents, this.hydrate);
    return await this.db.run(query);
  }

  async recordEvent(
    { project, ...props }: SetRequired<ExecuteProjectTransitionInput, 'step'>,
    _session: Session,
  ) {
    const created = e.insert(e.Project.WorkflowEvent, {
      project: e.cast(e.Project, e.uuid(project)),
      transitionKey: props.transition,
      step: props.step,
      notes: props.notes,
    });
    const query = e.select(created, this.hydrate);
    return await this.db.run(query);
  }
}
