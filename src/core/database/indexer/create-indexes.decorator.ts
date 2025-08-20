import { createMetadataDecorator } from '@seedcompany/nest';
import { type ILogger } from '../../logger';
import { type DatabaseService, type ServerInfo } from '../database.service';

export type IndexMode = 'write' | 'schema';

/**
 * Hook into DB indexing lifecycle with this decorator.
 *
 * It should be used on a provider method.
 * It's passed a db Connection for convenience.
 */
export const OnIndex = createMetadataDecorator({
  setter: (mode: IndexMode = 'write') => mode,
  types: ['method'],
});

export interface OnIndexParams {
  db: DatabaseService;
  logger: ILogger;
  serverInfo: ServerInfo;
}

export type Indexer = (
  params: OnIndexParams,
) => Promise<string | string[] | void>;

export const createUniqueConstraint = (
  nodeName: string,
  propertyName: string,
  constraintName = `${nodeName}_${propertyName}`,
) =>
  `CREATE CONSTRAINT ${constraintName} IF NOT EXISTS FOR (n:${nodeName}) REQUIRE n.${propertyName} IS UNIQUE`;
