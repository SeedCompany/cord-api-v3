import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ProducibleRepository } from '../product/producible.repository';
import { EthnoArt } from './dto';

@Injectable()
export class EthnoArtRepository extends ProducibleRepository<EthnoArt> {
  constructor(db: DrizzleService) {
    super(db, EthnoArt, 'EthnoArt');
  }
}
