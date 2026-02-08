import { type Engagement } from '../dto';

export class EngagementWillDeleteHook {
  constructor(readonly engagement: Engagement) {}
}
