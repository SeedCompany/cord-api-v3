import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { mapEntries } from '@seedcompany/common';
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

  async create<T extends ResourceShape<Notification>>(
    type: T,
    recipients: ReadonlyArray<ID<'User'>>,
    input: T extends { Input: infer Input } ? Input : InputOf<T['prototype']>,
  ) {
    const session = sessionFromContext(this.gqlContextHost.context);
    await this.repo.create(recipients, type, input, session);
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

  private secure(dto: UnsecuredDto<Notification>) {
    return { ...dto, canDelete: true };
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
  }
}
