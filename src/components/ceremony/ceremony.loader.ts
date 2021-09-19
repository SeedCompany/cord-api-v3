import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { CeremonyService } from './ceremony.service';
import { Ceremony } from './dto';

@Injectable({ scope: Scope.REQUEST })
export class CeremonyLoader extends OrderedNestDataLoader<Ceremony> {
  constructor(private readonly ceremonies: CeremonyService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.ceremonies.readMany(ids, this.session);
  }
}
