import { ServerException } from '~/common';

/**
 * A DB error.
 * Separate hierarchy from Neo4j because they are managed by us instead of driver.
 */
export class DatabaseException extends ServerException {}

export class NoRows extends DatabaseException {}

export class ExcessiveRows extends DatabaseException {}
