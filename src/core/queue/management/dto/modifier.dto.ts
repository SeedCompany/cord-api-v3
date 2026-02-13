import { ObjectType } from '@nestjs/graphql';
import { type Job, type Queue } from 'bullmq';

@ObjectType()
export class QueueModifier {
  queue: Queue;
}

@ObjectType()
export class JobModifier {
  job: Job;
  queue: Queue;
}
