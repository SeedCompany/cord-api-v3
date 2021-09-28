import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Partner } from './dto';
import { PartnerService } from './partner.service';

@Injectable({ scope: Scope.REQUEST })
export class PartnerLoader extends OrderedNestDataLoader<Partner> {
  constructor(private readonly partners: PartnerService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.partners.readMany(ids, this.session);
  }
}
