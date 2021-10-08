import {
  Field,
  Float,
  GqlTypeReference,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLBoolean, GraphQLScalarType, GraphQLString } from 'graphql';
import { isObject } from 'lodash';
import { Class, ConditionalKeys, ConditionalPick } from 'type-fest';
import { ISecured } from './secured.interface';
import { AbstractClassType } from './types';

export interface Secured<T> {
  readonly value?: T;
  readonly canRead: boolean;
  readonly canEdit: boolean;
}

export type SecuredProps<Dto extends Record<string, any>> = ConditionalPick<
  Dto,
  Secured<any>
>;

export type SecuredKeys<Dto extends Record<string, any>> = ConditionalKeys<
  Dto,
  Secured<any>
>;

/**
 * Converts a DTO to unwrap its secured properties.
 * Non-secured properties are left as is.
 *
 * So:
 * ```tsx
 * {
 *   foo: SecuredString;
 *   bar: DateTime;
 * }
 * ```
 * Becomes:
 * ```tsx
 * {
 *   foo: string;
 *   bar: DateTime;
 * }
 * ```
 */
export type UnsecuredDto<Dto> = {
  [K in keyof Dto as Exclude<K, 'canDelete'>]: UnwrapSecured<Dto[K]>;
};

/**
 * Specify this on a property to override the value type for UnsecuredDto on
 * the object.
 *
 * @example
 * class Foo {
 *   color: string & SetUnsecuredType<number>
 * }
 * const unsecured: UnsecuredDto<Foo> = {
 *   hexColor: 0xFFFFFF,
 * };
 */
export interface SetUnsecuredType<Value> {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- shush we are hiding this. It's only for TS types.
  __unsecured_type__?: Value;
}

export type UnwrapSecured<T> = T extends SetUnsecuredType<infer Override>
  ? Override
  : T extends Secured<infer P>
  ? P
  : T;

export const isSecured = <T>(value: T | Secured<T>): value is Secured<T> =>
  isObject(value) && 'canRead' in value && 'canEdit' in value;

export const unwrapSecured = <T>(value: T | Secured<T>): T | undefined =>
  isSecured(value) ? value.value : value;

export function SecuredEnum<
  T extends string,
  EnumValue extends string,
  Nullable extends boolean | undefined = false
>(
  valueClass: { [key in T]: EnumValue },
  options: SecuredPropertyOptions<Nullable> = {}
) {
  return InnerSecuredProperty<any, EnumValue, Nullable>(valueClass, options);
}

export function SecuredProperty<
  GqlType,
  TsType = GqlType,
  Nullable extends boolean | undefined = false
>(
  valueClass: Class<GqlType> | AbstractClassType<GqlType> | GraphQLScalarType,
  options: SecuredPropertyOptions<Nullable> = {}
) {
  return InnerSecuredProperty<typeof valueClass, TsType, Nullable>(
    valueClass,
    options
  );
}

export interface SecuredPropertyOptions<
  Nullable extends boolean | undefined = false
> {
  /** Whether the property can be null (when the requester can read) */
  nullable?: Nullable;
}

type SecuredValue<
  T,
  Nullable extends boolean | undefined
> = Nullable extends true ? T | null : T;

function InnerSecuredProperty<
  GqlType extends GqlTypeReference,
  TsType = GqlType,
  Nullable extends boolean | undefined = false
>(valueClass: GqlType, _options: SecuredPropertyOptions<Nullable> = {}) {
  @ObjectType({ isAbstract: true, implements: [ISecured] })
  abstract class SecuredPropertyClass
    implements ISecured, Secured<SecuredValue<TsType, Nullable>>
  {
    @Field(() => valueClass, { nullable: true })
    readonly value?: SecuredValue<TsType, Nullable>;
    @Field()
    readonly canRead: boolean;
    @Field()
    readonly canEdit: boolean;
  }

  return SecuredPropertyClass;
}

SecuredEnum.descriptionFor = SecuredProperty.descriptionFor = (
  value: string
) => stripIndent`
  An object with ${value} \`value\` and additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is \`null\`.
  These \`can*\` authorization properties are specific to the user making the request.
`;

type SecuredList<T, Nullable extends boolean | undefined> = SecuredValue<
  readonly T[],
  Nullable
>;

export function SecuredEnumList<
  T extends string,
  EnumValue extends string,
  Nullable extends boolean | undefined = false
>(
  valueClass: { [key in T]: EnumValue },
  options: SecuredPropertyOptions<Nullable> = {}
) {
  return SecuredList<EnumValue, EnumValue, Nullable>(
    valueClass as any,
    options
  );
}

export function SecuredPropertyList<
  T,
  Nullable extends boolean | undefined = false
>(
  valueClass: Class<T> | AbstractClassType<T> | GraphQLScalarType,
  options: SecuredPropertyOptions<Nullable> = {}
) {
  return SecuredList<typeof valueClass, T, Nullable>(valueClass, options);
}

function SecuredList<GQL, TS, Nullable extends boolean | undefined = false>(
  valueClass: GQL,
  options: SecuredPropertyOptions<Nullable> = {}
) {
  @ObjectType({ isAbstract: true, implements: [ISecured] })
  abstract class SecuredPropertyListClass
    implements ISecured, Secured<SecuredList<TS, Nullable>>
  {
    @Field(() => [valueClass], {
      nullable: options.nullable,
    })
    readonly value: SecuredList<TS, Nullable>;
    @Field()
    readonly canRead: boolean;
    @Field()
    readonly canEdit: boolean;
  }

  return SecuredPropertyListClass;
}

SecuredEnumList.descriptionFor = SecuredPropertyList.descriptionFor = (
  value: string
) => stripIndent`
  An object whose \`value\` is a list of ${value} and has additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is empty: \`[]\`.
  These \`can*\` authorization properties are specific to the user making the request.
`;

@ObjectType({
  description: SecuredProperty.descriptionFor('a string or null'),
})
export abstract class SecuredStringNullable extends SecuredProperty<
  string,
  string,
  true
>(GraphQLString, {
  nullable: true,
}) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a string'),
})
export abstract class SecuredString extends SecuredProperty<string>(
  GraphQLString
) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('an integer'),
})
export abstract class SecuredInt extends SecuredProperty<number>(Int) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('an integer or null'),
})
export abstract class SecuredIntNullable extends SecuredProperty<
  number,
  number,
  true
>(Int, {
  nullable: true,
}) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a float'),
})
export abstract class SecuredFloat extends SecuredProperty<number>(Float) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a float or null'),
})
export abstract class SecuredFloatNullable extends SecuredProperty<
  number,
  number,
  true
>(Float, { nullable: true }) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a boolean'),
})
export abstract class SecuredBoolean extends SecuredProperty<boolean>(
  GraphQLBoolean
) {}
