import { type Session, type UnsecuredDto } from '~/common';
import {
  type Engagement,
  InternshipEngagement,
  LanguageEngagement,
  type UpdateInternshipEngagement,
  type UpdateLanguageEngagement,
} from '../dto';

export class EngagementUpdatedEvent {
  constructor(
    public updated: UnsecuredDto<Engagement>,
    readonly previous: UnsecuredDto<Engagement>,
    readonly input: UpdateLanguageEngagement | UpdateInternshipEngagement,
    readonly session: Session,
  ) {}

  isLanguageEngagement(): this is EngagementUpdatedEvent & {
    updated: UnsecuredDto<LanguageEngagement>;
    input: UpdateLanguageEngagement;
  } {
    return LanguageEngagement.resolve(this.updated) === LanguageEngagement;
  }

  isInternshipEngagement(): this is EngagementUpdatedEvent & {
    updated: UnsecuredDto<InternshipEngagement>;
    input: UpdateInternshipEngagement;
  } {
    return LanguageEngagement.resolve(this.updated) === InternshipEngagement;
  }
}
