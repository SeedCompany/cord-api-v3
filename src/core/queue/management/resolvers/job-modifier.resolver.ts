import {
  Args,
  ArgsType,
  Int,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLJSON as AnyJson } from 'graphql-scalars';
import { Duration } from 'luxon';
import { OptionalField } from '~/common';
import { FinishedStatus, Job, JobModifier as Modifier } from '../dto';

@ArgsType()
class PriorityArgs {
  @OptionalField(() => Int, {
    description: 'The new priority. See `Job.priority` for details.',
  })
  readonly priority?: number;

  @OptionalField(() => Boolean, {
    description: 'The new lifo value.',
  })
  readonly lifo?: boolean;
}

@ArgsType()
class RetryArgs {
  @OptionalField(() => FinishedStatus, {
    description: stripIndent`
      The expected job state: \`failed\` or \`completed\`.

      If the job is not in the provided state, then it's not reprocessed.
    `,
  })
  readonly state?: FinishedStatus = FinishedStatus.Failed;
}

@Resolver(() => Modifier)
export class JobModifierResolver {
  @ResolveField(() => Job)
  async updateData(
    @Parent() { job }: Modifier,
    @Args({ name: 'data', type: () => AnyJson }) data: object,
  ) {
    await job.updateData(data);
    return job;
  }

  @ResolveField(() => Job)
  async updateProgress(
    @Parent() { job }: Modifier,
    @Args({ name: 'progress', type: () => AnyJson }) progress: object,
  ) {
    await job.updateProgress(progress);
    return job;
  }

  @ResolveField(() => Job)
  async changeDelay(
    @Parent() { job }: Modifier,
    @Args({ name: 'delay', type: () => Duration }) delay: Duration,
  ) {
    await job.changeDelay(+delay);
    return job;
  }

  @ResolveField(() => Job)
  async changePriority(
    @Parent() { job }: Modifier,
    @Args() args: PriorityArgs,
  ) {
    await job.changePriority(args);
    return job;
  }

  @ResolveField(() => Job, {
    description:
      'Promotes a delayed job so that it starts to be processed as soon as possible.',
  })
  async promote(@Parent() { job }: Modifier) {
    await job.promote();
    return job;
  }

  @ResolveField(() => Job, {
    description: stripIndent`
      Completely remove the job from the queue.

      Note, this call will throw an exception if the job
      is being processed when the call is performed.
    `,
  })
  async remove(@Parent() { job }: Modifier) {
    await job.remove();
    return job;
  }

  @ResolveField(() => Job, {
    description: stripIndent`
      Attempts to retry the job. Only a job that has failed or completed can be retried.
    `,
  })
  async retry(@Parent() { job }: Modifier, @Args() args: RetryArgs) {
    await job.retry(args.state);
    return job;
  }
}
