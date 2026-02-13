import { search } from '@aws-lambda-powertools/jmespath';
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
import { mapEntries } from '@seedcompany/common';
import { GraphQLJSONObject as JsonObject } from 'graphql-scalars';
import { IdArg, JmesPathScalar, Order } from '~/common';
import { Job, JobType, Queue } from '../dto';
import { QueueManagementService } from '../queue-management.service';
import { JobResolver } from './job.resolver';

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
  @Field(() => JmesPathScalar, { nullable: true })
  filter?: string;
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
  constructor(
    private readonly service: QueueManagementService,
    private readonly jobResolver: JobResolver,
  ) {}

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
    const jobs: Job[] = await queue.getJobs(
      args.types,
      args.start,
      args.end,
      args.order === Order.ASC,
    );

    const filterPath = args.filter;
    if (!filterPath) {
      return jobs;
    }

    let states: ReadonlyMap<Job, `${JobType}` | 'unknown'> = new Map();
    if (filterPath.includes('state')) {
      const list = await Promise.all(jobs.map((job) => job.getState()));
      states = mapEntries(jobs.entries(), ([i, job]) => [job, list[i]!]).asMap;
    }

    return jobs.filter((job) => {
      const gqlJob = new Proxy(job, {
        has: (target, p) => {
          if (Reflect.has(this.jobResolver, p)) {
            return true;
          }
          return Reflect.has(target, p);
        },
        get: (target, prop) => {
          if (prop === 'state') {
            return states.get(job);
          }
          if (Reflect.has(this.jobResolver, prop)) {
            return this.jobResolver[prop as keyof JobResolver](job, {});
          }
          return Reflect.get(target, prop);
        },
      });
      const result = search(filterPath, [gqlJob]);
      return !!result && (Array.isArray(result) ? result.length > 0 : true);
    });
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
