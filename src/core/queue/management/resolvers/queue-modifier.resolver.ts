import {
  Args,
  ArgsType,
  Field,
  ID,
  Int,
  Mutation,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLJSONObject as JsonObject } from 'graphql-scalars';
import { DateTime, Duration } from 'luxon';
import {
  DateTimeField,
  IdArg,
  InputException,
  NotFoundException,
  OptionalField,
} from '~/common';
import {
  FinishedStatus,
  Job,
  JobModifier,
  JobType,
  QueueModifier as Modifier,
  Queue,
} from '../dto';
import { QueueManagementService } from '../queue-management.service';

@ArgsType()
class AddQueueJob {
  @Field(() => String)
  readonly name: string;
  @Field(() => JsonObject, { nullable: true })
  readonly data?: object;
  @Field(() => JsonObject, { nullable: true })
  readonly options?: object;
}

@ArgsType()
class CleanArgs {
  @Field()
  readonly grace: Duration;
  @Field({
    description: 'Max number of jobs to clean',
  })
  readonly limit: number;
  @Field(() => JobType)
  readonly type: JobType = JobType.Completed;
}

@ObjectType('QueueCleanOutput')
class CleanOutput {
  @Field()
  queue: Queue;
  @Field(() => [ID])
  deletedIds: string[];
}

@ArgsType()
class DrainArgs {
  @OptionalField(() => Boolean, {
    description: 'Whether to also remove delayed jobs',
  })
  readonly delayed?: boolean = false;
}

@ArgsType()
class HasBatchSizeArgs {
  @OptionalField(() => Int, {
    description: stripIndent`
      How many jobs to move at once.
      This is not an overall limit - all jobs are still processed
    `,
  })
  readonly batchSize?: number = 1000;
}

@ArgsType()
class RetryArgs extends HasBatchSizeArgs {
  @OptionalField(() => FinishedStatus, {
    description: 'Which jobs to retry? failed or completed',
  })
  readonly state?: FinishedStatus = FinishedStatus.Failed;

  @DateTimeField({
    optional: true,
    description: stripIndent`
      When to start moving jobs to wait status.
      Mutually exclusive with \`startAfter\`.

      Defaults to now if neither are specified.
    `,
  })
  readonly startAt?: Date;

  @OptionalField(() => Duration, {
    description: stripIndent`
      When to start moving jobs to wait status.
      Mutually exclusive with \`startAt\`.

      Defaults to now if neither are specified.
    `,
  })
  readonly startAfter?: Duration;
}

@ArgsType()
class PromoteArgs extends HasBatchSizeArgs {}

@ArgsType()
class ObliterateArgs extends HasBatchSizeArgs {
  @OptionalField(() => Boolean, {
    description: 'Force obliteration even with active jobs in the queue',
  })
  force?: boolean = false;
}

@Resolver(() => Modifier)
export class QueueModifierResolver {
  constructor(private readonly service: QueueManagementService) {}

  @Mutation(() => Modifier)
  async modifyQueue(@Args('name') name: string): Promise<Modifier> {
    const queue = await this.service.findQueue(name);
    return { queue };
  }

  @ResolveField(() => JobModifier) async job(
    @Parent() { queue }: Modifier,
    @IdArg() id: string,
  ): Promise<JobModifier> {
    const job = await queue.getJob(id);
    if (!job) {
      throw new NotFoundException();
    }
    return { job, queue };
  }

  @ResolveField(() => Queue)
  async pause(@Parent() { queue }: Modifier): Promise<Queue> {
    await queue.pause();
    return queue;
  }

  @ResolveField(() => Queue)
  async resume(@Parent() { queue }: Modifier): Promise<Queue> {
    await queue.resume();
    return queue;
  }

  @ResolveField(() => Job)
  async add(@Parent() { queue }: Modifier, @Args() args: AddQueueJob) {
    return await queue.add(args.name, args.data, args.options);
  }

  @ResolveField(() => CleanOutput, {
    description: stripIndent`
      Removes certain jobs from the queue.
    `,
  })
  async clean(
    @Parent() { queue }: Modifier,
    @Args() args: CleanArgs,
  ): Promise<CleanOutput> {
    if (args.type === 'repeat' || args.type === 'waiting-children') {
      throw new InputException('Not a clean-able job type');
    }
    const deletedIds = await queue.clean(+args.grace, args.limit, args.type);
    return { queue, deletedIds };
  }

  @ResolveField(() => Queue, {
    description: stripIndent`
      Drains the queue, i.e., removes all jobs that are waiting
      or delayed, but not active, completed or failed.
    `,
  })
  async drain(@Parent() { queue }: Modifier, @Args() args: DrainArgs) {
    await queue.drain(args.delayed);
    return queue;
  }

  @ResolveField(() => Queue, {
    description: 'Retry all the failed or completed jobs',
  })
  async retryJobs(@Parent() { queue }: Modifier, @Args() args: RetryArgs) {
    await queue.retryJobs({
      count: args.batchSize,
      state: args.state,
      timestamp:
        (args.startAt
          ? DateTime.fromJSDate(args.startAt).toMillis()
          : undefined) ??
        (args.startAfter
          ? DateTime.now().plus(args.startAfter).toMillis()
          : undefined),
    });
    return queue;
  }

  @ResolveField(() => Queue, {
    description: 'Promote all the delayed jobs',
  })
  async promoteJobs(@Parent() { queue }: Modifier, @Args() args: PromoteArgs) {
    await queue.promoteJobs({
      count: args.batchSize,
    });
    return queue;
  }

  @ResolveField(() => Queue, {
    description: stripIndent`
      Completely destroys the queue and all of its contents irreversibly.

      This method will *pause* the queue and requires that there are no active jobs.
      It is possible to bypass this requirement, i.e. not having active jobs using the \`force\` option.

      Note: This operation requires to iterate on all the jobs stored in the queue
      and can be slow for very large queues.
    `,
  })
  async obliterate(
    @Parent() { queue }: Modifier,
    @Args() args: ObliterateArgs,
  ) {
    await queue.obliterate({
      count: args.batchSize,
      force: args.force,
    });
    return queue;
  }
}
