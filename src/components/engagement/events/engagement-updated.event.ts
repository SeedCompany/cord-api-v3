import { Session } from '../../../common';
import {
  Engagement,
  InternshipEngagement,
  LanguageEngagement,
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

  isLanguageEngagement(): this is EngagementUpdatedEvent & {
    engagement: LanguageEngagement;
    updates: UpdateLanguageEngagement;
  } {
    return this.updated.__typename === 'LanguageEngagement';
  }

  isInternshipEngagement(): this is EngagementUpdatedEvent & {
    engagement: InternshipEngagement;
    updates: UpdateInternshipEngagement;
  } {
    return this.updated.__typename === 'InternshipEngagement';
  }
}
