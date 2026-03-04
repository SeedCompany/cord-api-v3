import { search } from '@aws-lambda-powertools/jmespath';
import {
  Args,
  ArgsType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLJSON as AnyJson } from 'graphql-scalars';
import { DateTime, Duration, Info } from 'luxon';
import { InputException, JmesPathScalar, OptionalField } from '~/common';
import { GqlContextHost } from '~/core/graphql/gql-context.host';
import { Job, JobState, Queue } from '../dto';

@ArgsType()
class SearchArgs {
  @OptionalField(() => JmesPathScalar)
  path?: string;
}
const maybeSearch = (value: unknown, path?: string) =>
  path && value ? search(path, value) : value;

@Resolver(() => Job)
export class JobResolver {
  constructor(private readonly gqlContextHost: GqlContextHost) {}

  @ResolveField(() => Queue)
  queue(@Parent() job: Job) {
    return (job as any).queue;
  }

  @ResolveField(() => AnyJson, { nullable: true })
  data(@Parent() job: Job, @Args() { path }: SearchArgs) {
    return maybeSearch(job.data, path);
  }

  @ResolveField(() => AnyJson, { nullable: true })
  options(@Parent() job: Job, @Args() { path }: SearchArgs) {
    return maybeSearch(job.opts, path);
  }

  @ResolveField(() => AnyJson, { nullable: true })
  progress(@Parent() job: Job, @Args() { path }: SearchArgs) {
    return maybeSearch(job.progress, path);
  }

  @ResolveField(() => AnyJson, { nullable: true })
  return(@Parent() job: Job, @Args() { path }: SearchArgs) {
    return maybeSearch(job.returnvalue, path);
  }

  @ResolveField(() => [[String]])
  failures(@Parent() job: Job) {
    return job.stacktrace.map((stack) => stack.split('\n'));
  }

  @ResolveField(() => AnyJson, { nullable: true })
  json(@Parent() job: Job, @Args() { path }: SearchArgs) {
    return maybeSearch(job.toJSON(), path);
  }

  @ResolveField(() => JobState)
  async state(@Parent() job: Job) {
    return await job.getState();
  }

  @ResolveField(() => Duration)
  delayISO(@Parent() job: Job) {
    return Duration.fromMillis(job.delay);
  }

  @ResolveField(() => String)
  delayHuman(@Parent() job: Job) {
    return Duration.fromMillis(job.delay).rescale().toHuman({
      unitDisplay: 'short',
    });
  }

  @ResolveField(() => DateTime)
  createdAt(@Parent() job: Job) {
    const zone = this.currentZone();
    return DateTime.fromMillis(job.timestamp, { zone });
  }

  @ResolveField(() => DateTime, { nullable: true })
  finishedAt(@Parent() job: Job) {
    const zone = this.currentZone();

    return job.finishedOn
      ? DateTime.fromMillis(job.finishedOn, { zone })
      : undefined;
  }

  @ResolveField(() => DateTime, { nullable: true })
  processedAt(@Parent() job: Job) {
    const zone = this.currentZone();
    return job.processedOn
      ? DateTime.fromMillis(job.processedOn, { zone })
      : undefined;
  }

  private currentZone() {
    const raw = this.gqlContextHost.context.request?.headers['x-time-zone'];
    if (!raw) {
      return undefined;
    }
    const str = Array.isArray(raw) ? raw[0]! : raw;
    const zone = Info.normalizeZone(str);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (zone.isValid) {
      return zone;
    }
    throw new InputException(`X-Time-Zone value is invalid: ${str}`);
  }
}
