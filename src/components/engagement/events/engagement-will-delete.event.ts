import { Session } from '~/common';
import { Engagement } from '../dto';

export class EngagementWillDeleteEvent {
  constructor(readonly engagement: Engagement, readonly session: Session) {}
}
