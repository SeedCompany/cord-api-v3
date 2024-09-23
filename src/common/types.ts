import {
  OmitType as BaseOmitType,
  PartialType as BasePartialType,
  PickType as BasePickType,
  // eslint-disable-next-line @seedcompany/no-restricted-imports
  IntersectionType,
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

export function IntersectTypes<A, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
): IntersectedType<A, Args>;
export function IntersectTypes<A, B, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
): IntersectedType<A & B, Args>;
export function IntersectTypes<A, B, C, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
): IntersectedType<A & B & C, Args>;
export function IntersectTypes<A, B, C, D, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
): IntersectedType<A & B & C & D, Args>;
export function IntersectTypes<A, B, C, D, E, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
  type5: AbstractClass<E>,
): IntersectedType<A & B & C & D & E, Args>;
export function IntersectTypes<A, B, C, D, E, F, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
  type5: AbstractClass<E>,
  type6: AbstractClass<F>,
): IntersectedType<A & B & C & D & E & F, Args>;
export function IntersectTypes<A, B, C, D, E, F, G, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
  type5: AbstractClass<E>,
  type6: AbstractClass<F>,
  type7: AbstractClass<G>,
): IntersectedType<A & B & C & D & E & F & G, Args>;
export function IntersectTypes<A, B, C, D, E, F, G, H, Args extends unknown[]>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
  type5: AbstractClass<E>,
  type6: AbstractClass<F>,
  type7: AbstractClass<G>,
  type8: AbstractClass<H>,
): IntersectedType<A & B & C & D & E & F & G & H, Args>;
export function IntersectTypes<
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
  Args extends unknown[],
>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
  type5: AbstractClass<E>,
  type6: AbstractClass<F>,
  type7: AbstractClass<G>,
  type8: AbstractClass<H>,
  type9: AbstractClass<I>,
): IntersectedType<A & B & C & D & E & F & G & H & I, Args>;
export function IntersectTypes<
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
  Args extends unknown[],
>(
  type1: AbstractClass<A, Args>,
  type2: AbstractClass<B>,
  type3: AbstractClass<C>,
  type4: AbstractClass<D>,
  type5: AbstractClass<E>,
  type6: AbstractClass<F>,
  type7: AbstractClass<G>,
  type8: AbstractClass<H>,
  type9: AbstractClass<I>,
  ...types: Array<AbstractClass<any>>
): IntersectedType<unknown, Args>;
export function IntersectTypes<T, Args extends unknown[]>(
  ...types: Array<AbstractClass<T, Args>>
): IntersectedType<T, Args> {
  return Object.assign(
    (types as any).reduce(
      (a: any, b: any) => (a ? IntersectionType(a, b) : b),
      undefined,
    ),
    {
      members: types,
    },
  );
}

type IntersectedType<T, Args extends unknown[]> = Class<T, Args> & {
  members: Array<Class<unknown>>;
};

function TODOFn(..._args: any[]) {
  throw new NotImplementedException();
}
export const TODO = TODOFn as any;
// eslint-disable-next-line @seedcompany/no-unused-vars
export type TODO<A = any, B = any, C = any, D = any> = any;
