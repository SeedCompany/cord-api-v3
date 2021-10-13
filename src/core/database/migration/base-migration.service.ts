import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ID, Session } from '../../../common';
import { ILogger, Logger } from '../../logger';
import { DatabaseService } from '../database.service';

@Injectable()
export abstract class BaseMigration {
  @Inject(DatabaseService)
  protected db: DatabaseService;

  @Logger('database:migration')
  protected logger: ILogger;

  abstract up(): Promise<void>;

  /**
   * Sometimes a session is "needed" to read data from the app.
   * Usually it's required just to provide user authorization.
   * This is not guaranteed to work, especially for usage with writes.
   */
  get fakeAdminSession(): Session {
    return {
      token: '',
      issuedAt: DateTime.now(),
      roles: ['global:Administrator'],
      userId: 'fake admin :(' as ID,
      anonymous: false,
    };
  }
}
