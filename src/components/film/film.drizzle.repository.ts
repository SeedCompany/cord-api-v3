import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ProducibleDrizzleRepository } from '../product/producible.drizzle.repository';
import { Film } from './dto';

@Injectable()
export class FilmDrizzleRepository extends ProducibleDrizzleRepository<Film> {
  constructor(db: DrizzleService) {
    super(db, Film, 'Film');
  }
}
