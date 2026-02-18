import { Injectable } from '@nestjs/common';
import { ExternalContextCreator } from '@nestjs/core';
import { type FnLike } from '@seedcompany/common';
import { Cron, type CronCallback } from 'croner';
import { DateTime, Duration, Zone } from 'luxon';
import type { ConditionalKeys } from 'type-fest';
import { andCall } from '~/common';
import { Locker } from '~/core/locker';
import { type ScheduleOptions } from './schedule.options';

import './cron.inspect';

@Injectable()
export abstract class Scheduler {
  protected readonly jobs = new Map<string, Cron>();

  constructor(
    protected readonly locker: Locker,
    protected readonly externalContextCreator: ExternalContextCreator,
  ) {}

  getAll(): ReadonlyMap<string, Cron> {
    return this.jobs;
  }

  tryGet(name: string) {
    return this.jobs.get(name);
  }

  get(name: string) {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`No job found with the name "${name}"`);
    }
    return job;
  }

  register<T extends object, const MethodName extends string>(
    options: ScheduleOptions,
    fn:
      | readonly [
          cls: T,
          method:
            | (string extends MethodName
                ? MethodName
                : ConditionalKeys<T, CronCallback>)
            | symbol,
        ]
      | CronCallback,
  ) {
    if (this.jobs.has(options.name)) {
      throw new Error(
        `A job with the name "${options.name}" already exists. Please choose a different name.`,
      );
    }

    let wrapped;
    if (typeof fn === 'function') {
      // If given a raw function, associate it with the fake task host
      // This allows us to wrap it in the external context and allow the
      // global guards/interceptors/filters to work as expected.
      wrapped = this.wrapFn(options, [{}, '', fn]);
    } else {
      const [cls, method] = fn;
      wrapped = this.wrapFn(options, [cls, method, (cls as any)[method]]);
    }

    const cron = this.createTask(options);
    this.scheduleTask(cron, wrapped);
    return cron;
  }

  protected abstract scheduleTask(cron: Cron, fn: () => CronCallback): void;

  private wrapFn(
    options: ScheduleOptions,
    fn: readonly [cls: object, method: string | symbol, fn: CronCallback],
  ) {
    return () => {
      const wrappedFn = this.wrapInExternalContext(...fn);
      const exclusiveFn = this.wrapInLocker(options, wrappedFn);
      return exclusiveFn;
    };
  }

  private wrapInLocker(
    options: ScheduleOptions,
    fn: CronCallback,
  ): CronCallback {
    return async (...args) => {
      const lock = this.locker.getLock(options.name, options.lock);
      if (!(await lock.tryAcquire())) {
        return;
      }
      try {
        await fn(...args);
      } finally {
        await lock.dispose();
      }
    };
  }

  private wrapInExternalContext(
    cls: object,
    methodName: string | symbol,
    fn?: FnLike,
  ) {
    return this.externalContextCreator.create(
      cls,
      fn ?? (cls as any)[methodName],
      // @ts-expect-error I'm guessing symbols are fine they are just not typed
      methodName,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'scheduledTask',
    );
  }

  private createTask(options: ScheduleOptions) {
    const { schedule, startAt, stopAt, timezone, interval, ...rest } = options;

    const cron = new Cron(
      DateTime.isDateTime(schedule) ? schedule.toJSDate() : schedule,
      {
        ...rest,
        startAt: DateTime.isDateTime(startAt) ? startAt.toJSDate() : startAt,
        stopAt: DateTime.isDateTime(stopAt) ? stopAt.toJSDate() : stopAt,
        timezone: timezone instanceof Zone ? timezone.name : timezone,
        interval:
          interval == null ? undefined : Duration.from(interval).as('seconds'),
      },
    );

    andCall(cron, 'stop', () => {
      this.jobs.delete(options.name);
    });
    this.jobs.set(options.name, cron);

    return cron;
  }

  remove(name: string) {
    const job = this.get(name);
    job?.stop();
    return job;
  }
}

declare module '~/core/exe-ctx.type' {
  interface DeclareContextTypes {
    scheduledTask: true;
  }
}
