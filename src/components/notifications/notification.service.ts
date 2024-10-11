import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ID, ResourceShape, Session, UnsecuredDto } from '~/common';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationList,
  NotificationListInput,
} from './dto';
import { NotificationRepository } from './notification.repository';

@Injectable()
export abstract class NotificationService {
  @Inject(forwardRef(() => NotificationRepository))
  protected readonly repo: NotificationRepository & {};

  async create<T extends ResourceShape<Notification>>(
    recipients: ReadonlyArray<ID<'User'>>,
    type: T,
    input: unknown,
    session: Session,
  ) {
    await this.repo.create(recipients, type, input, session);
  }
}

@Injectable()
export class NotificationServiceImpl extends NotificationService {
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
}
