import { Duration } from 'luxon';
import { type ID } from '~/common';
import { type Job, Queue, registerQueues } from '~/core/queue';
import { type Notification, type NotificationType } from './dto';

export interface NotificationDeliveryData {
  readonly typeName: NotificationType;
  readonly notification: Notification;
  readonly recipients: ReadonlyArray<ID<'User'>>;
}

export class NotificationDeliveryQueue extends Queue<
  Job<NotificationDeliveryData>
> {
  static NAME = NotificationDeliveryQueue.nameFor(NotificationDeliveryQueue);
  static register = () =>
    registerQueues({
      name: NotificationDeliveryQueue,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: +Duration.from({ second: 10 }) },
        removeOnComplete: {
          age: Duration.from({ hour: 1 }).as('seconds'),
        },
        removeOnFail: {
          age: Duration.from({ day: 1 }).as('seconds'),
        },
      },
    });
}
