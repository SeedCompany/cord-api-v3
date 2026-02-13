import {
  Args,
  ArgsType,
  Field,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLJSONObject as JsonObject } from 'graphql-scalars';
import { IdArg, Order } from '~/common';
import { Job, JobType, Queue } from '../dto';
import { QueueManagementService } from '../queue-management.service';

@ArgsType()
class JobArgs {
  @Field(() => [JobType], { nullable: true })
  types?: JobType[];
  @Field(() => Int, { nullable: true })
  start?: number;
  @Field(() => Int, { nullable: true })
  end?: number;
  @Field(() => Order, { nullable: true })
  order?: Order;
}

@ArgsType()
class MetricArgs {
  @Field(() => Int, { nullable: true })
  start?: number;
  @Field(() => Int, { nullable: true })
  end?: number;
}

@Resolver(() => Queue)
export class QueueResolver {
  constructor(private readonly service: QueueManagementService) {}

  @Query(() => Queue)
  async queue(@Args('name') name: string): Promise<Queue> {
    return await this.service.findQueue(name);
  }

  @ResolveField(() => Boolean)
  async paused(@Parent() queue: Queue) {
    return await queue.isPaused();
  }

  @ResolveField(() => Boolean)
  async maxed(@Parent() queue: Queue) {
    return await queue.isMaxed();
  }

  @ResolveField(() => JsonObject)
  async jobCounts(@Parent() queue: Queue) {
    return await queue.getJobCounts();
  }

  @ResolveField(() => [Job])
  async jobs(@Parent() queue: Queue, @Args() args: JobArgs) {
    return await queue.getJobs(
      args.types,
      args.start,
      args.end,
      args.order === Order.ASC,
    );
  }

  @ResolveField(() => Job, { nullable: true })
  async job(@Parent() queue: Queue, @IdArg() id: string) {
    return await queue.getJob(id);
  }

  @ResolveField(() => JsonObject)
  async metricsCompleted(@Parent() queue: Queue, @Args() args: MetricArgs) {
    return await queue.getMetrics('completed', args.start, args.end);
  }

  @ResolveField(() => JsonObject)
  async metricsFailed(@Parent() queue: Queue, @Args() args: MetricArgs) {
    return await queue.getMetrics('failed', args.start, args.end);
  }
}
