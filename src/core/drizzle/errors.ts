import { DatabaseError } from 'pg';
import { DuplicateException, InputException } from '~/common';
import { PgErrorCode } from './pg-error-codes';

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
    if (
      e instanceof DatabaseError &&
      e.code === PgErrorCode.UniqueViolation &&
      e.constraint?.includes(constraintMatch)
    ) {
      throw new DuplicateException(field, message, e);
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
    if (
      e instanceof DatabaseError &&
      e.code === PgErrorCode.ForeignKeyViolation &&
      e.constraint?.includes(constraintMatch)
    ) {
      throw new InputException(message, field, e);
    }
    throw e as Error;
  };
