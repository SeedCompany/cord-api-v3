import { Injectable, Scope } from '@nestjs/common';
import { ID, ObjectView } from '../../common';
import { ObjectViewAwareLoader } from '../../core';
import { Engagement } from './dto';
import { EngagementService } from './engagement.service';

@Injectable({ scope: Scope.REQUEST })
export class EngagementLoader extends ObjectViewAwareLoader<Engagement> {
  constructor(private readonly engagements: EngagementService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view: ObjectView) {
    return await this.engagements.readMany(ids, this.session, view);
  }
}
