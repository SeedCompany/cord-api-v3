import {
  Args,
  ArgsType,
  Field,
  Int,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IsTimeZone, Max, Min } from 'class-validator';
import { type Cron } from 'croner';
import { DateTime, Duration, Info } from 'luxon';
import {
  DateTimeField,
  DateTimeFormat,
  InputException,
  OptionalField,
  UnauthorizedException,
} from '~/common';
import { Identity } from '~/core/authentication';
import { GqlContextHost } from '~/core/graphql/gql-context.host';
import { Scheduler } from '../scheduler.service';

@ObjectType()
class ScheduledTask {
  task: Cron;
  @Field()
  name: string;
  @Field()
  enabled: boolean;
  @Field()
  busy: boolean;
  @Field()
  stopped: boolean;
  @Field(() => Int, { nullable: true })
  runsLeft?: number;

  static from(task: Cron): ScheduledTask {
    const runsLeft = task.runsLeft();
    return {
      task,
      name: task.name!,
      enabled: task.isRunning(),
      busy: task.isBusy(),
      stopped: task.isStopped(),
      runsLeft: runsLeft && !isFinite(runsLeft) ? undefined : runsLeft,
    };
  }
}

@ArgsType()
class TemporalFormatArgs {
  @OptionalField(() => DateTimeFormat)
  format?: DateTimeFormat;
}

@ArgsType()
class TemporalArgs extends TemporalFormatArgs {
  @OptionalField(() => String)
  @IsTimeZone()
  timezone?: string;
}

@ArgsType()
class MultiTemporalArgs extends TemporalArgs {
  @Field(() => Int)
  @Min(1)
  @Max(10)
  count = 3;

  @DateTimeField({ optional: true })
  from?: DateTime;
}

@Resolver(ScheduledTask)
export class ScheduledTaskResolver {
  constructor(
    private readonly scheduler: Scheduler,
    private readonly identity: Identity,
    private readonly gqlContextHost: GqlContextHost,
  ) {}

  @Query(() => [ScheduledTask])
  scheduledTasks(): ScheduledTask[] {
    if (!this.identity.isAdmin) {
      throw new UnauthorizedException();
    }
    return [...this.scheduler.getAll().values()].map(ScheduledTask.from);
  }

  @Query(() => ScheduledTask, { nullable: true })
  scheduledTask(@Args('name') name: string): ScheduledTask | null {
    if (!this.identity.isAdmin) {
      throw new UnauthorizedException();
    }
    const task = this.scheduler.tryGet(name);
    return task ? ScheduledTask.from(task) : null;
  }

  @ResolveField(() => String, { nullable: true })
  currentRun(@Parent() { task }: ScheduledTask, @Args() args: TemporalArgs) {
    const date = task.currentRun();
    return date ? this.formatDate(date, args) : null;
  }

  @ResolveField(() => String, { nullable: true })
  previousRun(@Parent() { task }: ScheduledTask, @Args() args: TemporalArgs) {
    const date = task.previousRun();
    return date ? this.formatDate(date, args) : null;
  }

  @ResolveField(() => String, { nullable: true })
  timeUntilNext(
    @Parent() { task }: ScheduledTask,
    @Args() args: TemporalFormatArgs,
  ) {
    const ms = task.msToNext();
    if (ms == null) {
      return null;
    }
    const d = Duration.from(ms).rescale();
    return this.getFormat(args) === 'ISO' ? d.toISO() : d.toHuman();
  }

  @ResolveField(() => String, { nullable: true })
  nextRun(@Parent() { task }: ScheduledTask, @Args() args: TemporalArgs) {
    const date = task.nextRun();
    return date ? this.formatDate(date, args) : null;
  }

  @ResolveField(() => [String])
  nextRuns(@Parent() { task }: ScheduledTask, @Args() args: MultiTemporalArgs) {
    const runs = task.nextRuns(args.count, args.from?.toJSDate());
    return runs.map((date) => this.formatDate(date, args));
  }

  @ResolveField(() => [String])
  previousRuns(
    @Parent() { task }: ScheduledTask,
    @Args() args: MultiTemporalArgs,
  ) {
    const runs = task.previousRuns(args.count, args.from?.toJSDate());
    return runs.map((date) => this.formatDate(date, args));
  }

  private formatDate(date: Date, { format, timezone }: TemporalArgs) {
    const dt = DateTime.fromJSDate(date, {
      zone: timezone ?? this.getZoneFromHeader(),
    });
    return this.getFormat({ format }) === 'ISO'
      ? dt.toISO()
      : dt.toLocaleString({
          ...DateTime.TIME_WITH_SHORT_OFFSET,
          ...(!dt.hasSame(DateTime.now(), 'day') ? { weekday: 'long' } : {}),
        });
  }

  private getFormat(args: TemporalFormatArgs) {
    return args.format ?? this.getFormatFromHeader() ?? DateTimeFormat.ISO;
  }

  private getFormatFromHeader() {
    const raw = this.gqlContextHost.context.request?.headers['x-time-format'];
    if (!raw) {
      return undefined;
    }
    const str = Array.isArray(raw) ? raw[0]! : raw;
    if (DateTimeFormat.has(str)) {
      return str;
    }
    throw new InputException(`X-Time-Format value is invalid: ${str}`);
  }

  private getZoneFromHeader() {
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
