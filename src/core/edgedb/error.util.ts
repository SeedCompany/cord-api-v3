import { ExclusivityViolationError } from './exclusivity-violation.error';

export const isExclusivityViolation = (e: unknown, property: string) =>
  e instanceof ExclusivityViolationError && e.property === property;
