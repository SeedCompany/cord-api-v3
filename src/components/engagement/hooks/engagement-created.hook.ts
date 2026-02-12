import { type UnsecuredDto } from '~/common';
import {
  type CreateInternshipEngagement,
  type CreateLanguageEngagement,
  type Engagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../dto';

export class EngagementCreatedHook {
  constructor(
    public engagement: UnsecuredDto<Engagement>,
    readonly input: CreateLanguageEngagement | CreateInternshipEngagement,
  ) {}

  isLanguageEngagement(): this is EngagementCreatedHook & {
    engagement: UnsecuredDto<LanguageEngagement>;
    input: CreateLanguageEngagement;
  } {
    return LanguageEngagement.resolve(this.engagement) === LanguageEngagement;
  }

  isInternshipEngagement(): this is EngagementCreatedHook & {
    engagement: UnsecuredDto<InternshipEngagement>;
    input: CreateInternshipEngagement;
  } {
    return LanguageEngagement.resolve(this.engagement) === InternshipEngagement;
  }
}
