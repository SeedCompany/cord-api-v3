import { ID, ObjectView } from '~/common';
import { LoaderFactory, ObjectViewAwareLoader } from '~/core';
import {
  Engagement,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
} from './dto';
import { EngagementService } from './engagement.service';

@LoaderFactory(() => [IEngagement, LanguageEngagement, InternshipEngagement])
export class EngagementLoader extends ObjectViewAwareLoader<Engagement> {
  constructor(private readonly engagements: EngagementService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view: ObjectView) {
    return await this.engagements.readMany(ids, this.session, view);
  }
}
