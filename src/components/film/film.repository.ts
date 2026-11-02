import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ProducibleRepository } from '../product/producible.repository';
import { Film } from './dto';

@Injectable()
export class FilmRepository extends ProducibleRepository<Film> {
  constructor(db: DrizzleService) {
    super(db, Film, 'Film');
  }
}
