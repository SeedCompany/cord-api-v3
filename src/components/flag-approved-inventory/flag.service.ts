import { Injectable } from '@nestjs/common';
import { ID } from '../../common';
import { FlagRepository } from './flag.repository';

@Injectable()
export class FlagService {
  constructor(private readonly repo: FlagRepository) {}

  async isFlagged(id: ID, approvedInventory: boolean): Promise<boolean> {
    return await this.repo.isFlagged(id, approvedInventory);
  }

  async toggleFlagged(
    id: ID, 
    flagged?: boolean
  ): Promise<boolean> {
    flagged ??= (await this.repo.isFlagged(id, true));
    if (!flagged) {
      await this.repo.add(id);
    } else {
      await this.repo.remove(id);
    }
    return !flagged;
  }
}
