import { ConstraintViolationError } from 'edgedb';

export const isExclusivityViolation = (e: unknown, property: string) =>
  e instanceof ConstraintViolationError &&
  e.message === `${property} violates exclusivity constraint`;
