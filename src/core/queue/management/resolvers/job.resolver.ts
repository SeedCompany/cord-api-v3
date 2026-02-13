import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Queue } from 'bullmq';
import {
  GraphQLJSON as AnyJson,
  GraphQLJSONObject as JsonObject,
} from 'graphql-scalars';
import { DateTime, Duration, Info } from 'luxon';
import { InputException } from '~/common';
import { GqlContextHost } from '~/core/graphql/gql-context.host';
import { Job } from '../dto';

@Resolver(() => Job)
export class JobResolver {
  constructor(private readonly gqlContextHost: GqlContextHost) {}

  @ResolveField(() => Queue)
  queue(@Parent() job: Job) {
    return (job as any).queue;
  }

  @ResolveField(() => JsonObject, { nullable: true })
  options(@Parent() job: Job) {
    return job.opts;
  }

  @ResolveField(() => AnyJson, { nullable: true })
  return(@Parent() job: Job) {
    return job.returnvalue;
  }

  @ResolveField(() => JsonObject)
  json(@Parent() job: Job) {
    return job;
  }

  @ResolveField(() => String)
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
