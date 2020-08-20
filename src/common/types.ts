import { Type } from '@nestjs/common';
import {
  IntersectionType as BaseIntersectionType,
  OmitType as BaseOmitType,
  PartialType as BasePartialType,
  PickType as BasePickType,
} from '@nestjs/graphql';
import { ClassDecoratorFactory } from '@nestjs/graphql/dist/interfaces/class-decorator-factory.interface';

/**
 * Used for generic GraphQL types
 */
export type AbstractClassType<T> = {
  prototype: T;
  // eslint-disable-next-line @typescript-eslint/ban-types
} & Function;

/**
 * Used for conditional generics
 */
export type AnyFn = (...args: any) => any;

/**
 * The PartialType() function returns a type (class) with all the properties of
 * the input type set to optional.
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#partial
 */
export const PartialType = BasePartialType as <T>(
  classRef: AbstractClassType<T>
) => Type<Partial<T>>;

/**
 * The PickType() function constructs a new type (class) by picking a set of
 * properties from an input type.
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#pick
 */
export const PickType = BasePickType as <T, K extends keyof T>(
  classRef: AbstractClassType<T>,
  keys: readonly K[],
  decorator?: ClassDecoratorFactory
) => Type<Pick<T, typeof keys[number]>>;

/**
 * The OmitType() function constructs a type by picking all properties from an
 * input type and then removing a particular set of keys.
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#omit
 */
export const OmitType = BaseOmitType as <T, K extends keyof T>(
  classRef: AbstractClassType<T>,
  keys: readonly K[],
  decorator?: ClassDecoratorFactory
) => Type<Omit<T, typeof keys[number]>>;

/**
 * The IntersectionType() function combines two types into one new type (class).
 *
 * This just changes the signature to work with abstract classes.
 *
 * @see https://docs.nestjs.com/graphql/mapped-types#intersection
 */
export const IntersectionType = BaseIntersectionType as <A, B>(
  classARef: AbstractClassType<A>,
  classBRef: AbstractClassType<B>,
  decorator?: ClassDecoratorFactory
) => Type<A & B>;
