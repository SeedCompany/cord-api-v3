import { ID, ObjectView } from '~/common';
import { LoaderFactory, ObjectViewAwareLoader } from '~/core';
import { Partnership } from './dto';
import { PartnershipService } from './partnership.service';

@LoaderFactory(() => Partnership)
export class PartnershipLoader extends ObjectViewAwareLoader<Partnership> {
  constructor(private readonly partnerships: PartnershipService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view: ObjectView) {
    return await this.partnerships.readMany(ids, this.session, view);
  }
}
