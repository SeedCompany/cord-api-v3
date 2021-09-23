import { Inject, Injectable } from '@nestjs/common';
import { ILogger, Logger } from '../../logger';
import { DatabaseService } from '../database.service';

/**
 * Each migration should be decorated with `@Migration()` decorator
 * that registers it as a migration (it also needs to be _provided_ in a module).
 *
 * The decorator asks for an ISO time that's used as the "DB schema's version."
 * This controls the order that the migrations are run and is referenced to
 * determine if the migration has already been ran or not. This date should
 * never be in the past.
 *
 * Migrations are currently ran directly after all the deployment of API servers.
 * This means it's safe to remove data that is no longer referenced as of the
 * commit the migration is in.
 * WARNING: This also means there's a short period of time where data could be
 * asked for but it has not been created/moved yet.
 */
@Injectable()
export abstract class BaseMigration {
  @Inject(DatabaseService)
  protected db: DatabaseService;

  @Logger('database:migration')
  protected logger: ILogger;

  abstract up(): Promise<void>;
}
