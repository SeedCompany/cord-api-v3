import { Injectable } from '@nestjs/common';
import { ID, Session } from '~/common';
import { e, edgeql, RepoFor } from '~/core/edgedb';
import { ProjectStep } from '../dto';
import { ExecuteProjectTransitionInput, ProjectWorkflowEvent } from './dto';

@Injectable()
export class ProjectWorkflowRepository extends RepoFor(ProjectWorkflowEvent, {
  hydrate: (event) => ({
    id: true,
    who: true,
    at: true,
    transition: event.transitionKey,
    to: true,
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
    input: Omit<ExecuteProjectTransitionInput, 'bypassTo'> & {
      to: ProjectStep;
    },
    _session: Session,
  ) {
    const created = e.insert(e.Project.WorkflowEvent, {
      project: e.cast(e.Project, e.uuid(input.project)),
      transitionKey: input.transition,
      to: input.to,
      notes: input.notes,
    });
    const query = e.select(created, this.hydrate);
    return await this.db.run(query);
  }

  async mostRecentStep(
    projectId: ID<'Project'>,
    steps: readonly ProjectStep[],
  ) {
    const query = edgeql(`
      with
       project := <Project><uuid>$projectId,
       steps := array_unpack(<array<Project::Step>>$steps),
       mostRecentEvent := (
        select project.workflowEvents
        filter .to in steps if exists steps else true
        order by .at desc
        limit 1
      )
      select mostRecentEvent.to
    `);
    return await this.db.run(query, { projectId, steps });
  }
}
