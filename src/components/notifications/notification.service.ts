import {
  forwardRef,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { mapEntries, type Nil } from '@seedcompany/common';
import Event from 'gel/dist/primitives/event.js';
import {
  type ID,
  type ResourceShape,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Broadcaster } from '~/core/broadcast';
import { MetadataDiscovery } from '~/core/discovery';
import {
  type MarkNotificationReadArgs,
  type Notification,
  type NotificationList,
  type NotificationListInput,
} from './dto';
import { NotificationAdded } from './dto/notification-added.event';
import { NotificationRepository } from './notification.repository';
import {
  INotificationStrategy,
  type InputOf,
  NotificationStrategy,
} from './notification.strategy';

@Injectable()
export abstract class NotificationService {
  @Inject(forwardRef(() => NotificationRepository))
  protected readonly repo: NotificationRepository & {};

  /**
   * If the recipient list is given (not nil), it will override the strategy's recipient resolution.
   */
  async create<T extends ResourceShape<Notification>>(
    type: T,
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    input: T extends { Input: infer Input } ? Input : InputOf<T['prototype']>,
  ) {
    const { dto, ...rest } = await this.repo.create(recipients, type, input);
    return {
      ...rest,
      notification: this.secure(dto) as T['prototype'],
    };
  }

  protected secure(dto: UnsecuredDto<Notification>) {
    return { ...dto, canDelete: true };
  }
}

@Injectable()
export class NotificationServiceImpl
  extends NotificationService
  implements OnModuleInit
{
  strategyMap: ReadonlyMap<
    ResourceShape<Notification>,
    INotificationStrategy<Notification>
  >;
  readonly ready = new ((Event as any).default as typeof Event)();

  constructor(
    private readonly discovery: MetadataDiscovery,
    @Inject(forwardRef(() => Broadcaster))
    private readonly broadcaster: Broadcaster & {},
  ) {
    super();
  }

  async create<T extends ResourceShape<Notification>>(
    type: T,
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    input: T extends { Input: infer Input } ? Input : InputOf<T['prototype']>,
  ) {
    const out = await super.create(type, recipients, input);
    const { notification } = out;

    // from app, or dynamic db, or static by strategy
    const broadcastTo =
      recipients ?? out.recipients ?? this.getStrategy(type).broadcastTo();
    for (const recipient of broadcastTo) {
      this.broadcaster.channel(NotificationAdded, recipient).publish({
        notification,
      });
    }

    return out;
  }

  getStrategy(type: ResourceShape<Notification>) {
    const strategy = this.strategyMap.get(type);
    if (!strategy) {
      throw new ServerException('Notification type has not been registered');
    }
    return strategy;
  }

  async list(input: NotificationListInput): Promise<NotificationList> {
    const result = await this.repo.list(input);
    return {
      ...result,
      items: result.items.map((dto) => this.secure(dto)),
    };
  }

  async markRead(input: MarkNotificationReadArgs) {
    const result = await this.repo.markRead(input);
    return this.secure(result);
  }

  async onModuleInit() {
    const discovered = this.discovery.discover(NotificationStrategy).classes();
    this.strategyMap = mapEntries(discovered, ({ meta, instance }) => {
      if (!(instance instanceof INotificationStrategy)) {
        throw new ServerException(
          `Strategy for ${meta.name} does not implement INotificationStrategy`,
        );
      }
      return [meta, instance];
    }).asMap;
    this.ready.set();
  }
}
