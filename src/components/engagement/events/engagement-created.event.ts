import { ISession } from '../../../common';
import { Engagement } from '../dto';

export class EngagementCreatedEvent {
  constructor(readonly engagement: Engagement, readonly session: ISession) {}
}
