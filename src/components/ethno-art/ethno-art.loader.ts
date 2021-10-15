import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { EthnoArt } from './dto';
import { EthnoArtService } from './ethno-art.service';

@Injectable({ scope: Scope.REQUEST })
export class EthnoArtLoader extends OrderedNestDataLoader<EthnoArt> {
  constructor(private readonly ethnoArt: EthnoArtService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.ethnoArt.readMany(ids, this.session);
  }
}
