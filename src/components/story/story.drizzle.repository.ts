import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ProducibleDrizzleRepository } from '../product/producible.drizzle.repository';
import { Story } from './dto';

@Injectable()
export class StoryDrizzleRepository extends ProducibleDrizzleRepository<Story> {
  constructor(db: DrizzleService) {
    super(db, Story, 'Story');
  }
}
