import {
  IntersectionType as BaseIntersectionType,
  OmitType as BaseOmitType,
  PartialType as BasePartialType,
  PickType as BasePickType,
} from '@nestjs/graphql';
import { ClassDecoratorFactory } from '@nestjs/graphql/dist/interfaces/class-decorator-factory.interface';
import { AbstractClass, Class } from 'type-fest';
import { NotImplementedException } from './exceptions';

/**
 * Used for generic GraphQL types
 * @deprecated Use AbstractClass from type-fest
 */
export type AbstractClassType<T> = (abstract new (...args: any[]) => T) & {
  prototype: T;
};

export interface Range<T> {
  start: T;
  end: T;
}

/**
 * Useful to _implement_ existing class, ignoring private/protected members.
 */
export type PublicOf<T> = { [P in keyof T]: T[P] };

/**
 * The PartialType() function returns a type (class) with all the properties of
 * the input type set to optional.
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#partial
 */
export const PartialType = BasePartialType as <T, Args extends unknown[]>(
  classRef: AbstractClass<T, Args>,
) => Class<Partial<T>, Args>;

/**
 * The PickType() function constructs a new type (class) by picking a set of
 * properties from an input type.
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#pick
 */
export const PickType = BasePickType as <
  T,
  K extends keyof T,
  Args extends unknown[],
>(
  classRef: AbstractClass<T, Args>,
  keys: readonly K[],
  decorator?: ClassDecoratorFactory,
) => Class<Pick<T, (typeof keys)[number]>, Args>;

/**
 * The OmitType() function constructs a type by picking all properties from an
 * input type and then removing a particular set of keys.
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#omit
 */
export const OmitType = BaseOmitType as <
  T,
  K extends keyof T,
  Args extends unknown[],
>(
  classRef: AbstractClass<T, Args>,
  keys: readonly K[],
  decorator?: ClassDecoratorFactory,
) => Class<Omit<T, (typeof keys)[number]>, Args>;

/**
 * The IntersectionType() function combines two types into one new type (class).
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#intersection
 */
export const IntersectionType = BaseIntersectionType as <
  A,
  B,
  Args extends unknown[],
>(
  classARef: AbstractClass<A, Args>,
  classBRef: AbstractClass<B>,
  decorator?: ClassDecoratorFactory,
) => Class<A & B, Args>;

function TODOFn(..._args: any[]) {
  throw new NotImplementedException();
}
export const TODO = TODOFn as any;
// eslint-disable-next-line @seedcompany/no-unused-vars
export type TODO<A = any, B = any, C = any, D = any> = any;
