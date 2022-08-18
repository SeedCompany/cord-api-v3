import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { EthnoArt } from './dto';
import { EthnoArtService } from './ethno-art.service';

@LoaderFactory(() => EthnoArt)
export class EthnoArtLoader extends OrderedNestDataLoader<EthnoArt> {
  constructor(private readonly ethnoArt: EthnoArtService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.ethnoArt.readMany(ids, this.session);
  }
}
