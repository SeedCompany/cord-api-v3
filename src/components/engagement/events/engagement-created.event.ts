import { Session, UnsecuredDto } from '../../../common';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  CreatePublicationEngagement,
  Engagement,
  InternshipEngagement,
  LanguageEngagement,
  PublicationEngagement,
} from '../dto';

export class EngagementCreatedEvent {
  constructor(
    public engagement: UnsecuredDto<Engagement>,
    readonly input: CreateLanguageEngagement | CreateInternshipEngagement,
    readonly session: Session
  ) {}

  isLanguageEngagement(): this is EngagementCreatedEvent & {
    engagement: UnsecuredDto<LanguageEngagement>;
    input: CreateLanguageEngagement;
  } {
    return this.engagement.__typename === 'LanguageEngagement';
  }

  isInternshipEngagement(): this is EngagementCreatedEvent & {
    engagement: UnsecuredDto<InternshipEngagement>;
    input: CreateInternshipEngagement;
  } {
    return this.engagement.__typename === 'InternshipEngagement';
  }

  isPublicationEngagement(): this is EngagementCreatedEvent & {
    engagement: UnsecuredDto<PublicationEngagement>;
    input: CreatePublicationEngagement;
  } {
    return this.engagement.__typename === 'PublicationEngagement';
  }
}
