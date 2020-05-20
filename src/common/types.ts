/**
 * Used for generic GraphQL types
 */
export type AbstractClassType<T> = {
  prototype: T;
} & Function;

/**
 * Used for conditional generics
 */
export type AnyFn = (...args: any) => any;
