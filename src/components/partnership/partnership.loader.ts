import { Injectable, Scope } from '@nestjs/common';
import { ID, ObjectView } from '../../common';
import { ObjectViewAwareLoader } from '../../core';
import { Partnership } from './dto';
import { PartnershipService } from './partnership.service';

@Injectable({ scope: Scope.REQUEST })
export class PartnershipLoader extends ObjectViewAwareLoader<Partnership> {
  constructor(private readonly partnerships: PartnershipService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view: ObjectView) {
    return await this.partnerships.readMany(ids, this.session, view);
  }
}
