import { Session, UnsecuredDto } from '~/common';
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
    readonly session: Session,
    readonly input?: UpdateLanguageEngagement | UpdateInternshipEngagement,
  ) {}

  isLanguageEngagement(): this is EngagementUpdatedEvent & {
    updated: UnsecuredDto<LanguageEngagement>;
    input: UpdateLanguageEngagement;
  } {
    return this.updated.__typename === 'LanguageEngagement';
  }

  isInternshipEngagement(): this is EngagementUpdatedEvent & {
    updated: UnsecuredDto<InternshipEngagement>;
    input: UpdateInternshipEngagement;
  } {
    return this.updated.__typename === 'InternshipEngagement';
  }
}
