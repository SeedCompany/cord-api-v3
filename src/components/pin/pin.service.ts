import { Injectable } from '@nestjs/common';
import { Session } from '../../common';
import { PinRepository } from './pin.repository';

@Injectable()
export class PinService {
  constructor(private readonly repo: PinRepository) {}

  async isPinned(id: string, session: Session): Promise<boolean> {
    return await this.repo.isPinned(id, session);
  }

  async togglePinned(
    id: string,
    session: Session,
    pinned?: boolean
  ): Promise<boolean> {
    const isPinned = await this.repo.isPinned(id, session);
    pinned ??= !isPinned;
    if (pinned && !isPinned) {
      await this.repo.add(id, session);
    } else if (!pinned && isPinned) {
      await this.repo.remove(id, session);
    }
    return pinned;
  }
}
