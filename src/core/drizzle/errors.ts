import { DatabaseError } from 'pg';
import { DuplicateException, InputException } from '~/common';
import { PgErrorCode } from './pg-error-codes';

/**
 * Drizzle wraps driver failures (`DrizzleQueryError: Failed query: ...`) with
 * the underlying `pg.DatabaseError` on `cause`, so walk the cause chain to
 * find it. A bare `instanceof DatabaseError` check no longer matches.
 */
const findDatabaseError = (e: unknown): DatabaseError | undefined => {
  let current = e;
  while (current != null) {
    if (current instanceof DatabaseError) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
};

/**
 * Whether the error (or anything in its cause chain) is a PostgreSQL
 * unique-constraint violation on a constraint whose name contains
 * `constraintMatch`. For callers that need to branch instead of rethrow.
 */
export const isUniqueViolation = (
  e: unknown,
  constraintMatch: string,
): boolean => {
  const dbError = findDatabaseError(e);
  return (
    !!dbError &&
    dbError.code === PgErrorCode.UniqueViolation &&
    !!dbError.constraint?.includes(constraintMatch)
  );
};

/**
 * Promise `.catch()` handler that maps a PostgreSQL unique-constraint
 * violation to a `DuplicateException`. `constraintMatch` is checked as a
 * substring against the failing constraint name.
 *
 * @example
 *   .catch(catchUniqueViolation('email', 'email', 'Email already in use'))
 */
export const catchUniqueViolation =
  (constraintMatch: string, field: string, message: string) =>
  (e: unknown): never => {
    const dbError = findDatabaseError(e);
    if (
      dbError &&
      dbError.code === PgErrorCode.UniqueViolation &&
      dbError.constraint?.includes(constraintMatch)
    ) {
      throw new DuplicateException(field, message, e as Error);
    }
    throw e as Error;
  };

/**
 * Promise `.catch()` handler that maps a PostgreSQL foreign-key violation to
 * an `InputException` carrying the GraphQL input `field` name — preserves the
 * "which form field caused this" context that the Neo4j repos achieve via
 * `e.withField(...)`. `constraintMatch` is checked as a substring against the
 * failing constraint name (e.g. `'field_region_id_fkey'` to scope the catch
 * to one side of a junction's two FKs).
 *
 * @example
 *   .catch(catchForeignKeyViolation(
 *     'field_region_id_fkey',
 *     'fieldRegions',
 *     'One or more field region IDs do not exist',
 *   ))
 */
export const catchForeignKeyViolation =
  (constraintMatch: string, field: string, message: string) =>
  (e: unknown): never => {
    const dbError = findDatabaseError(e);
    if (
      dbError &&
      dbError.code === PgErrorCode.ForeignKeyViolation &&
      dbError.constraint?.includes(constraintMatch)
    ) {
      throw new InputException(message, field, e as Error);
    }
    throw e as Error;
  };
