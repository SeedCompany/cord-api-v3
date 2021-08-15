import { Injectable } from '@nestjs/common';
import { ID, Session } from '../../common';
import { FlagRepository } from './flag.repository';

@Injectable()
export class FlagService {
  constructor(private readonly repo: FlagRepository) {}

  async isPinned(id: ID, session: Session): Promise<boolean> {
    return await this.repo.isFlagged(id, session);
  }

  async toggleFlagged(
    id: ID,
    session: Session,
    flagged?: boolean
  ): Promise<boolean> {
    flagged ??= !(await this.repo.isFlagged(id, session));
    if (!flagged) {
      await this.repo.add(id, session);
    } else {
      await this.repo.remove(id, session);
    }
    return flagged;
  }
}
