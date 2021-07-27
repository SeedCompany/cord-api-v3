import { SetMetadata } from '@nestjs/common';
import { ILogger } from '../../logger';
import { DatabaseService, ServerInfo } from '../database.service';
import { DB_INDEX_KEY } from './indexer.constants';

export type IndexMode = 'write' | 'schema';

/**
 * Hook into DB indexing lifecycle with this decorator.
 *
 * It should be used on a provider method.
 * It's passed a db Connection for convenience.
 */
export const OnIndex = (mode: IndexMode = 'write') =>
  SetMetadata(DB_INDEX_KEY, mode);

export interface OnIndexParams {
  db: DatabaseService;
  logger: ILogger;
  serverInfo: ServerInfo;
}

export type Indexer = (
  params: OnIndexParams
) => Promise<string | string[] | void>;
