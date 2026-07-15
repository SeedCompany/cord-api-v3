import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ProducibleDrizzleRepository } from '../product/producible.drizzle.repository';
import { EthnoArt } from './dto';

@Injectable()
export class EthnoArtDrizzleRepository extends ProducibleDrizzleRepository<EthnoArt> {
  constructor(db: DrizzleService) {
    super(db, EthnoArt, 'EthnoArt');
  }
}
