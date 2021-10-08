import { Session } from '../../../common';
import {
  Engagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from '../dto';

export class EngagementUpdatedEvent {
  constructor(
    public updated: Engagement,
    readonly previous: Engagement,
    readonly updates: UpdateLanguageEngagement | UpdateInternshipEngagement,
    readonly session: Session
  ) {}
}
