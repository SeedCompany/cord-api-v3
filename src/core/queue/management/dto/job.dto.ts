import { ID, ObjectType } from '@nestjs/graphql';
import { Job } from 'bullmq';
import { stripIndent } from 'common-tags';
import { declareGqlFields } from '~/common';

ObjectType('QueueJob')(Job);
declareGqlFields(Job, {
  id: { type: () => ID },
  name: { type: () => String },
  stacktrace: { type: () => [String] },
  priority: {
    type: () => Number,
    description: stripIndent`
      Ranges from 0 (highest priority) to 2 097 152 (lowest priority).
      Note that using priorities has a slight impact on performance,
      so do not use it if not required.

      @default 0
   `,
  },
  attemptsStarted: {
    type: () => Number,
    description:
      'Number of attempts when job is moved to active.\n\n@default 0',
  },
  attemptsMade: {
    type: () => Number,
    description: 'Number of attempts after the job has failed.\n\n@default 0',
  },
  failedReason: { type: () => String, nullable: true },
});

export { Job };
