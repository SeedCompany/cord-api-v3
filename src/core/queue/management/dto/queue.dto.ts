import { ObjectType } from '@nestjs/graphql';
import { Queue } from 'bullmq';
import { declareGqlFields } from '~/common';

ObjectType('Queue')(Queue);
declareGqlFields(Queue, {
  name: { type: () => String },
});

export { Queue };
