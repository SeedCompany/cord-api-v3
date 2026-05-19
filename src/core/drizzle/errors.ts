import { DatabaseError } from 'pg';
import { DuplicateException } from '~/common';
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
