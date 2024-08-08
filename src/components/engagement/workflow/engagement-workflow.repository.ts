import { Injectable } from '@nestjs/common';
import { ID, Session, UnsecuredDto } from '~/common';
import { e, edgeql, RepoFor } from '~/core/edgedb';
import { EngagementStatus } from '../dto';
import {
  EngagementWorkflowEvent,
  ExecuteEngagementTransitionInput,
} from './dto';

@Injectable()
export class EngagementWorkflowRepository extends RepoFor(
  EngagementWorkflowEvent,
  {
    hydrate: (event) => ({
      id: true,
      who: true,
      at: true,
      transition: event.transitionKey,
      to: true,
      notes: true,
      engagement: true,
    }),
    omit: ['list', 'create', 'update', 'delete', 'readMany'],
  },
) {
  async readMany(ids: readonly ID[], _session: Session) {
    return await this.defaults.readMany(ids);
  }

  async list(engagementId: ID, _session: Session) {
    const engagement = e.cast(e.Engagement, e.uuid(engagementId));
    const query = e.select(engagement.workflowEvents, this.hydrate);
    return await this.db.run(query);
  }

  async recordEvent(
    input: Omit<ExecuteEngagementTransitionInput, 'bypassTo'> & {
      to: EngagementStatus;
    },
    _session: Session,
  ): Promise<UnsecuredDto<EngagementWorkflowEvent>> {
    const engagement = e.cast(e.Engagement, e.uuid(input.engagement));
    const created = e.insert(e.Engagement.WorkflowEvent, {
      engagement,
      projectContext: engagement.projectContext,
      transitionKey: input.transition,
      to: input.to,
      notes: input.notes,
    });
    const query = e.select(created, this.hydrate);
    return await this.db.run(query);
  }

  async mostRecentStep(
    engagementId: ID<'Engagement'>,
    steps: readonly EngagementStatus[],
  ) {
    const query = edgeql(`
      with
       engagement := <Engagement><uuid>$engagementId,
        steps := array_unpack(<array<Engagement::Status>>$steps),
        mostRecentEvent := (
          select engagement.workflowEvents
          filter .to in steps if exists steps else true
          order by .at desc
          limit 1
        )
      select mostRecentEvent.to
    `);
    return await this.db.run(query, { engagementId, steps });
  }
}
