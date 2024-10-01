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
