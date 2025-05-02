import { type Session } from '~/common';
import { type Engagement } from '../dto';

export class EngagementWillDeleteEvent {
  constructor(readonly engagement: Engagement, readonly session: Session) {}
}
