import { Session } from '../../../common';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
} from '../dto';

export class EngagementCreatedEvent {
  constructor(
    public engagement: Engagement,
    readonly input: CreateLanguageEngagement | CreateInternshipEngagement,
    readonly session: Session
  ) {}
}
