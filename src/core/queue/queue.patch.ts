import { BullModule } from '@nestjs/bullmq';
import type { Type } from '@nestjs/common';
import { cleanJoin, setInspectOnClass } from '@seedcompany/common';
import { Case } from '@seedcompany/common/case';
import {
  type FlowJob,
  Job,
  type JobsOptions,
  Queue as QueueBase,
  RedisConnection,
  Worker,
} from 'bullmq';

type QueueCls = Type<Queue<any>> & { NAME?: string };

export class Queue<TJob extends Job> extends QueueBase<TJob> {
  static nameFor = (queueCls: QueueCls) => {
    queueCls.NAME ??= Case.kebab(queueCls.name.replace(/Queue$/, ''));
    return queueCls.NAME;
  };

  // @ts-expect-error this is fixing the base signature to work with unions discriminated on the job name
  async add<Name extends TJob['name']>(
    name: Name,
    data: string extends TJob['name']
      ? TJob['data']
      : TJob extends Job<infer Data, any, Name>
        ? Data
        : never,
    opts?: JobsOptions,
  ): Promise<TJob>;
  // @ts-expect-error adding this for unity with flows
  async add(
    jobDefinition: Omit<FlowJob, 'children'> & {
      prefix?: undefined;
      children?: undefined;
    },
  ): Promise<TJob>;
  // @ts-expect-error adding this for unity with flows
  async add(...args: any[]) {
    if (args.length === 1) {
      args = [args[0].name, args[0].data, args[0].opts];
    }
    // @ts-expect-error blah blah spread/rest/array
    const job = await super.add(...args);
    return job;
  }
}
BullModule.queueClass = Queue;

setInspectOnClass(Job, (job) => ({
  collapsedId: cleanJoin(' - ', [job.id, job.name]),
  exclude: ['toKey', 'scripts', 'queueQualifiedName'],
}));
setInspectOnClass(Queue, (queue) => ({
  collapsedId: queue.name,
  include: ['name', 'token', 'closed'],
}));
setInspectOnClass(Worker, (worker) => ({
  collapsedId: worker.name,
  include: [
    'name',
    'id',
    'opts',
    'running',
    'closed',
    'waiting',
    'drained',
    'blockUntil',
    'limitUntil',
  ],
}));
setInspectOnClass(RedisConnection, () => ({
  include: ['status', '_client', 'capabilities', 'extraOptions'],
}));
