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
import { DateTime } from 'luxon';
import { Class } from 'type-fest';
import { CalendarDate, DateField, DateTimeField } from '.';
import { Editable } from './editable.interface';
import { Readable } from './readable.interface';
import { AbstractClassType } from './types';

export interface Secured<T> {
  readonly value?: T;
  readonly canRead: boolean;
  readonly canEdit: boolean;
}

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
export type UnsecuredDto<Dto> = { [K in keyof Dto]: UnwrapSecured<Dto[K]> };

export type UnwrapSecured<T> = T extends Secured<infer P> ? P : T;

export const isSecured = <T>(value: T | Secured<T>): value is Secured<T> =>
  isObject(value);

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
  @ObjectType({ isAbstract: true, implements: [Readable, Editable] })
  abstract class SecuredPropertyClass
    implements Readable, Editable, Secured<SecuredValue<TsType, Nullable>> {
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
  T[],
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
  @ObjectType({ isAbstract: true, implements: [Readable, Editable] })
  abstract class SecuredPropertyListClass
    implements Readable, Editable, Secured<SecuredList<TS, Nullable>> {
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

@ObjectType({ implements: [Readable, Editable] })
export abstract class SecuredDateTime
  implements Readable, Editable, Secured<DateTime> {
  @DateTimeField({ nullable: true })
  readonly value?: DateTime;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}

@ObjectType({ implements: [Readable, Editable] })
export abstract class SecuredDateTimeNullable
  implements Readable, Editable, Secured<DateTime | null> {
  @DateTimeField({ nullable: true })
  readonly value?: DateTime | null;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}

@ObjectType({ implements: [Readable, Editable] })
export abstract class SecuredDate
  implements Readable, Editable, Secured<CalendarDate> {
  @DateField({ nullable: true })
  readonly value?: CalendarDate;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}

@ObjectType({ implements: [Readable, Editable] })
export abstract class SecuredDateNullable
  implements Readable, Editable, Secured<CalendarDate | null> {
  @DateField({ nullable: true })
  readonly value?: CalendarDate | null;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}
