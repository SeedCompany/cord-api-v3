import {
  forwardRef,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { mapEntries, type Nil } from '@seedcompany/common';
import Event from 'gel/dist/primitives/event.js';
import { from, mergeMap } from 'rxjs';
import {
  type ID,
  type ResourceShape,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Broadcaster } from '~/core/broadcast';
import { TransactionHooks } from '~/core/database';
import { MetadataDiscovery } from '~/core/discovery';
import {
  type MarkNotificationReadArgs,
  type Notification,
  type NotificationList,
  type NotificationListInput,
  type NotificationType,
} from './dto';
import { NotificationAdded } from './dto/notification-added.hook';
import { NotificationDeliveryQueue } from './notification-delivery.queue';
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

  abstract readonly strategiesByClassType: ReadonlyMap<
    ResourceShape<Notification>,
    INotificationStrategy<Notification>
  >;

  abstract readonly strategiesByNameType: ReadonlyMap<
    NotificationType,
    INotificationStrategy<Notification>
  >;

  getStrategy(type: ResourceShape<Notification>) {
    const strategy = this.strategiesByClassType.get(type);
    if (!strategy) {
      throw new ServerException('Notification type has not been registered');
    }
    return strategy;
  }

  getTypeName(type: ResourceShape<Notification>) {
    // This conversion is hacky and duplicated in the NotificationStrategy decorator.
    return type.name.replace('Notification', '') as NotificationType;
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
  strategiesByClassType: ReadonlyMap<
    ResourceShape<Notification>,
    INotificationStrategy<Notification>
  >;
  strategiesByNameType: ReadonlyMap<
    NotificationType,
    INotificationStrategy<Notification>
  >;
  typeClassToName: ReadonlyMap<ResourceShape<Notification>, NotificationType>;
  readonly ready = new ((Event as any).default as typeof Event)();

  constructor(
    private readonly discovery: MetadataDiscovery,
    @Inject(forwardRef(() => Broadcaster))
    private readonly broadcaster: Broadcaster & {},
    private readonly deliveryQueue: NotificationDeliveryQueue,
    private readonly txHooks: TransactionHooks,
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

    this.txHooks.afterCommit.add(async () => {
      await this.deliveryQueue.add('deliver', {
        typeName: this.typeClassToName.get(type)!,
        notification,
        recipients: recipients ?? out.recipients ?? [],
      });
    });

    return out;
  }

  async list(input: NotificationListInput): Promise<NotificationList> {
    const result = await this.repo.list(input);
    return {
      ...result,
      items: result.items.map((dto) => this.secure(dto)),
    };
  }

  /**
   * Listen for notifications added for the user.
   */
  added$(user: ID<'User'>) {
    // Merge user's broadcast channel with static ones defined by strategies.
    const strategies = this.strategiesByClassType.values().toArray();
    return from([
      user,
      ...strategies.flatMap((strategy) => strategy.broadcastTo()),
    ]).pipe(
      mergeMap((id) => {
        return this.broadcaster.channel(NotificationAdded, id);
      }),
    );
  }

  async markRead(input: MarkNotificationReadArgs) {
    const result = await this.repo.markRead(input);
    return this.secure(result);
  }

  async onModuleInit() {
    const discovered = this.discovery.discover(NotificationStrategy).classes();
    this.strategiesByClassType = mapEntries(
      discovered,
      ({ meta: { cls }, instance }) => {
        if (!(instance instanceof INotificationStrategy)) {
          throw new ServerException(
            `Strategy for ${cls.name} does not implement INotificationStrategy`,
          );
        }
        return [cls, instance];
      },
    ).asMap;
    this.strategiesByNameType = mapEntries(
      discovered,
      ({ meta: { cls, typeName }, instance }) => {
        if (!(instance instanceof INotificationStrategy)) {
          throw new ServerException(
            `Strategy for ${cls.name} does not implement INotificationStrategy`,
          );
        }
        return [typeName, instance];
      },
    ).asMap;
    this.typeClassToName = mapEntries(discovered, ({ meta }) => [
      meta.cls,
      meta.typeName,
    ]).asMap;
    this.ready.set();
  }
}
