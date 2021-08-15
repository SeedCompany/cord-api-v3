import { Injectable } from '@nestjs/common';
import { ID } from '../../common';
import { FlagRepository } from './flag.repository';

@Injectable()
export class FlagService {
  constructor(private readonly repo: FlagRepository) {}

  async isPinned(id: ID): Promise<boolean> {
    return await this.repo.isFlagged(id);
  }

  async toggleFlagged(id: ID, flagged?: boolean): Promise<boolean> {
    flagged ??= !(await this.repo.isFlagged(id));
    if (!flagged) {
      await this.repo.add(id);
    } else {
      await this.repo.remove(id);
    }
    return flagged;
  }
}
