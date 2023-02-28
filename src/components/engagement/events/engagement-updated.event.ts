import { Session, UnsecuredDto } from '../../../common';
import {
  Engagement,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from '../dto';

export class EngagementUpdatedEvent {
  constructor(
    public updated: UnsecuredDto<Engagement>,
    readonly previous: UnsecuredDto<Engagement>,
    readonly updates: UpdateLanguageEngagement | UpdateInternshipEngagement,
    readonly session: Session,
  ) {}

  isLanguageEngagement(): this is EngagementUpdatedEvent & {
    engagement: UnsecuredDto<LanguageEngagement>;
    updates: UpdateLanguageEngagement;
  } {
    return this.updated.__typename === 'LanguageEngagement';
  }

  isInternshipEngagement(): this is EngagementUpdatedEvent & {
    engagement: UnsecuredDto<InternshipEngagement>;
    updates: UpdateInternshipEngagement;
  } {
    return this.updated.__typename === 'InternshipEngagement';
  }
}
