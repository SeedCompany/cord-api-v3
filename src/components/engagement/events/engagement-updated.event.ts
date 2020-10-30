import { Session } from '../../../common';
import { Engagement, UpdateEngagement } from '../dto';

export class EngagementUpdatedEvent {
  constructor(
    public updated: Engagement,
    readonly previous: Engagement,
    readonly updates: UpdateEngagement,
    readonly session: Session
  ) {}
}
