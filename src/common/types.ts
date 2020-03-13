/**
 * Used for generic GraphQL types
 */
export type AbstractClassType<T> = {
  prototype: T;
} & Function;
