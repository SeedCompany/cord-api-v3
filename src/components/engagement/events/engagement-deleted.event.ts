import { Session } from '../../../common';
import { Engagement } from '../dto';

export class EngagementDeletedEvent {
  constructor(readonly engagement: Engagement, readonly session: Session) {}
}
