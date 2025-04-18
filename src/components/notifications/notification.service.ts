import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { mapEntries, Nil } from '@seedcompany/common';
import Event from 'gel/dist/primitives/event.js';
import {
  ID,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { sessionFromContext } from '~/common/session';
import { GqlContextHost } from '~/core/graphql';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationList,
  NotificationListInput,
} from './dto';
import { NotificationRepository } from './notification.repository';
import {
  INotificationStrategy,
  InputOf,
  NotificationStrategy,
} from './notification.strategy';

@Injectable()
export abstract class NotificationService {
  @Inject(forwardRef(() => NotificationRepository))
  protected readonly repo: NotificationRepository & {};
  @Inject(GqlContextHost)
  protected readonly gqlContextHost: GqlContextHost;

  /**
   * If the recipient list is given (not nil), it will override the strategy's recipient resolution.
   */
  async create<T extends ResourceShape<Notification>>(
    type: T,
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    input: T extends { Input: infer Input } ? Input : InputOf<T['prototype']>,
  ) {
    const session = sessionFromContext(this.gqlContextHost.context);
    const { dto, ...rest } = await this.repo.create(
      recipients,
      type,
      input,
      session,
    );
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

  constructor(private readonly discovery: DiscoveryService) {
    super();
  }

  getStrategy(type: ResourceShape<Notification>) {
    const strategy = this.strategyMap.get(type);
    if (!strategy) {
      throw new ServerException('Notification type has not been registered');
    }
    return strategy;
  }

  async list(
    input: NotificationListInput,
    session: Session,
  ): Promise<NotificationList> {
    const result = await this.repo.list(input, session);
    return {
      ...result,
      items: result.items.map((dto) => this.secure(dto)),
    };
  }

  async markRead(input: MarkNotificationReadArgs, session: Session) {
    const result = await this.repo.markRead(input, session);
    return this.secure(result);
  }

  async onModuleInit() {
    const discovered = await this.discovery.providersWithMetaAtKey<
      ResourceShape<Notification>
    >(NotificationStrategy.KEY);
    this.strategyMap = mapEntries(discovered, ({ meta, discoveredClass }) => {
      const { instance } = discoveredClass;
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
