import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { EthnoArt } from './dto';
import { EthnoArtService } from './ethno-art.service';

@LoaderFactory(() => EthnoArt)
export class EthnoArtLoader implements DataLoaderStrategy<EthnoArt, ID<EthnoArt>> {
  constructor(private readonly ethnoArt: EthnoArtService) {}

  async loadMany(ids: ReadonlyArray<ID<EthnoArt>>) {
    return await this.ethnoArt.readMany(ids);
  }
}
