import { Session } from '../../../common';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../dto';

export class EngagementCreatedEvent {
  constructor(
    public engagement: Engagement,
    readonly input: CreateLanguageEngagement | CreateInternshipEngagement,
    readonly session: Session
  ) {}

  isLanguageEngagement(): this is EngagementCreatedEvent & {
    engagement: LanguageEngagement;
    input: CreateLanguageEngagement;
  } {
    return this.engagement.__typename === 'LanguageEngagement';
  }

  isInternshipEngagement(): this is EngagementCreatedEvent & {
    engagement: InternshipEngagement;
    input: CreateInternshipEngagement;
  } {
    return this.engagement.__typename === 'InternshipEngagement';
  }
}
