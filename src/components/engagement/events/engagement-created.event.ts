import { type UnsecuredDto } from '~/common';
import {
  type CreateInternshipEngagement,
  type CreateLanguageEngagement,
  type Engagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../dto';

export class EngagementCreatedEvent {
  constructor(
    public engagement: UnsecuredDto<Engagement>,
    readonly input: CreateLanguageEngagement | CreateInternshipEngagement,
  ) {}

  isLanguageEngagement(): this is EngagementCreatedEvent & {
    engagement: UnsecuredDto<LanguageEngagement>;
    input: CreateLanguageEngagement;
  } {
    return LanguageEngagement.resolve(this.engagement) === LanguageEngagement;
  }

  isInternshipEngagement(): this is EngagementCreatedEvent & {
    engagement: UnsecuredDto<InternshipEngagement>;
    input: CreateInternshipEngagement;
  } {
    return LanguageEngagement.resolve(this.engagement) === InternshipEngagement;
  }
}
