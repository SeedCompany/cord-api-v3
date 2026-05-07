// PostgreSQL error codes from https://www.postgresql.org/docs/current/errcodes-appendix.html
export const PgErrorCode = {
  NotNullViolation: '23502',
  ForeignKeyViolation: '23503',
  UniqueViolation: '23505',
  CheckViolation: '23514',
} as const;
