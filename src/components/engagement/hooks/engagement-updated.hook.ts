import { type UnsecuredDto } from '~/common';
import {
  type Engagement,
  InternshipEngagement,
  LanguageEngagement,
  type UpdateInternshipEngagement,
  type UpdateLanguageEngagement,
} from '../dto';

export class EngagementUpdatedHook {
  constructor(
    public updated: UnsecuredDto<Engagement>,
    readonly previous: UnsecuredDto<Engagement>,
    readonly input: UpdateLanguageEngagement | UpdateInternshipEngagement,
  ) {}

  isLanguageEngagement(): this is EngagementUpdatedHook & {
    updated: UnsecuredDto<LanguageEngagement>;
    input: UpdateLanguageEngagement;
  } {
    return LanguageEngagement.resolve(this.updated) === LanguageEngagement;
  }

  isInternshipEngagement(): this is EngagementUpdatedHook & {
    updated: UnsecuredDto<InternshipEngagement>;
    input: UpdateInternshipEngagement;
  } {
    return LanguageEngagement.resolve(this.updated) === InternshipEngagement;
  }
}
