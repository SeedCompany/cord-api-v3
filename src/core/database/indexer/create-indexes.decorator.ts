import { SetMetadata } from '@nestjs/common';
import { ILogger } from '../../logger';
import { DatabaseService } from '../database.service';
import { DB_INDEX_KEY } from './indexer.constants';

/**
 * Hook into DB indexing lifecycle with this decorator.
 *
 * It should be used on a provider method.
 * It's passed a db Connection for convenience.
 */
export const OnIndex = () => SetMetadata(DB_INDEX_KEY, true);

export interface OnIndexParams {
  db: DatabaseService;
  logger: ILogger;
}

export type Indexer = (
  params: OnIndexParams
) => Promise<string | string[] | void>;
