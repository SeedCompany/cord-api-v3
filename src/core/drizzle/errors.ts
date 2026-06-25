import { DatabaseError } from 'pg';
import { DuplicateException } from '~/common';
import { PgErrorCode } from './pg-error-codes';

/**
 * Resolve the underlying pg `DatabaseError` from a thrown value. drizzle-orm
 * rethrows query-execution failures wrapped in a `DrizzleQueryError`
 * ("Failed query: ...") with the original pg error on `.cause`, so a bare
 * `instanceof DatabaseError` check no longer matches. Unwrap one level so the
 * constraint-mapping helpers keep working. Reuse for any future pg-error
 * matcher (FK violation, check constraint, etc.).
 */
const asDatabaseError = (e: unknown): DatabaseError | undefined =>
  e instanceof DatabaseError
    ? e
    : e instanceof Error && e.cause instanceof DatabaseError
      ? e.cause
      : undefined;

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
    const dbError = asDatabaseError(e);
    if (
      dbError?.code === PgErrorCode.UniqueViolation &&
      dbError.constraint?.includes(constraintMatch)
    ) {
      throw new DuplicateException(field, message, dbError);
    }
    throw e as Error;
  };
