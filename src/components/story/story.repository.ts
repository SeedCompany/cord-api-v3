import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ProducibleRepository } from '../product/producible.repository';
import { Story } from './dto';

@Injectable()
export class StoryRepository extends ProducibleRepository<Story> {
  constructor(db: DrizzleService) {
    super(db, Story, 'Story');
  }
}
