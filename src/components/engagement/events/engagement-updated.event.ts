import { ISession } from '../../../common';
import { Engagement, UpdateEngagement } from '../dto';

export class EngagementUpdatedEvent {
  constructor(
    readonly updated: Engagement,
    readonly previous: Engagement,
    readonly updates: UpdateEngagement,
    readonly session: ISession
  ) {}
}
