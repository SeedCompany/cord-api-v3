/**
 * Used for generic GraphQL types
 */
export type AbstractClassType<T> = {
  prototype: T;
} & Function; // tslint:disable-line:ban-types
