import { Injectable } from '@nestjs/common';
import { ID } from '../../common';
import { PinRepository } from './pin.repository';

@Injectable()
export class PinService {
  constructor(private readonly repo: PinRepository) {}

  async isPinned(id: ID): Promise<boolean> {
    return await this.repo.isPinned(id);
  }

  async togglePinned(id: ID, pinned?: boolean): Promise<boolean> {
    pinned ??= !(await this.repo.isPinned(id));
    if (pinned) {
      await this.repo.add(id);
    } else {
      await this.repo.remove(id);
    }
    return pinned;
  }
}
