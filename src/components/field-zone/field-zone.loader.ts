import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { FieldZone } from './dto';
import { FieldZoneService } from './field-zone.service';

@Injectable({ scope: Scope.REQUEST })
export class FieldZoneLoader extends OrderedNestDataLoader<FieldZone> {
  constructor(private readonly fieldZones: FieldZoneService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.fieldZones.readMany(ids, this.session);
  }
}
