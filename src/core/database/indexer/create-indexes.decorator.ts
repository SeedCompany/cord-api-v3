import { SetMetadata } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { ILogger } from '../../logger';
import { DB_INDEX_KEY } from './indexer.constants';

/**
 * Hook into DB indexing lifecycle with this decorator.
 *
 * It should be used on a provider method.
 * It's passed a db Connection for convenience.
 */
export const OnIndex = () => SetMetadata(DB_INDEX_KEY, true);

export interface OnIndexParams {
  db: Connection;
  logger: ILogger;
}

export type Indexer = (
  params: OnIndexParams,
) => Promise<string | string[] | void>;
