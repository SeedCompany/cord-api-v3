import { Injectable } from '@nestjs/common';
import { ID, Session } from '../../common';
import { PinRepository } from './pin.repository';

@Injectable()
export class PinService {
  constructor(private readonly repo: PinRepository) {}

  async isPinned(id: ID, session: Session): Promise<boolean> {
    return await this.repo.isPinned(id, session);
  }

  async togglePinned(
    id: ID,
    session: Session,
    pinned?: boolean
  ): Promise<boolean> {
    pinned ??= !(await this.repo.isPinned(id, session));
    if (pinned) {
      await this.repo.add(id, session);
    } else {
      await this.repo.remove(id, session);
    }
    return pinned;
  }
}
