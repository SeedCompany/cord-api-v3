import { type Engagement } from '../dto';

export class EngagementWillDeleteEvent {
  constructor(readonly engagement: Engagement) {}
}
