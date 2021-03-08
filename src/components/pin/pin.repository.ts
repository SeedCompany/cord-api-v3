import { Injectable } from '@nestjs/common';
import { NotImplementedException, Session } from '../../common';
import { DatabaseService } from '../../core';

/* eslint-disable @seedcompany/no-unused-vars -- Remove this when implementing */

@Injectable()
export class PinRepository {
  constructor(private readonly db: DatabaseService) {}

  async isPinned(id: string, session: Session): Promise<boolean> {
    throw new NotImplementedException();
  }

  async togglePinned(
    id: string,
    pinned: boolean,
    session: Session
  ): Promise<void> {
    throw new NotImplementedException();
  }
}
