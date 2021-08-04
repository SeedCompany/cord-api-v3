import { Inject, Injectable } from '@nestjs/common';
import { ILogger, Logger } from '../../logger';
import { DatabaseService } from '../database.service';

@Injectable()
export abstract class BaseMigration {
  @Inject(DatabaseService)
  protected db: DatabaseService;

  @Logger('database:migration')
  protected logger: ILogger;

  abstract up(): Promise<void>;
}
