import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
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

export type UnwrapSecured<T> = T extends Secured<infer P> ? P : T;

export const isSecured = <T>(value: T | Secured<T>): value is Secured<T> =>
  isObject(value);

export const unwrapSecured = <T>(value: T | Secured<T>): T | undefined =>
  isSecured(value) ? value.value : value;

export function SecuredProperty<GqlType, TsType = GqlType>(
  valueClass:
    | Class<GqlType>
    | AbstractClassType<GqlType>
    | GraphQLScalarType
    | object
) {
  @ObjectType({ isAbstract: true, implements: [Readable, Editable] })
  abstract class SecuredPropertyClass
    implements Readable, Editable, Secured<TsType> {
    @Field(() => valueClass, { nullable: true })
    readonly value?: TsType;
    @Field()
    readonly canRead: boolean;
    @Field()
    readonly canEdit: boolean;
  }

  return SecuredPropertyClass;
}

SecuredProperty.descriptionFor = (value: string) => stripIndent`
  An object with ${value} \`value\` and additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is \`null\`.
  These \`can*\` authorization properties are specific to the user making the request.
`;

export interface SecuredPropertyListOptions<
  Override extends boolean | undefined = false
> {
  isOverride?: Override;
}

type SecuredList<
  T,
  Override extends boolean | undefined
> = Override extends true ? T[] | null | undefined : T[];

export function SecuredEnumList<
  T extends string,
  EnumValue extends string,
  Override extends boolean | undefined = false
>(
  valueClass: { [key in T]: EnumValue },
  options: SecuredPropertyListOptions<Override> = {}
) {
  return SecuredList<EnumValue, EnumValue, Override>(
    valueClass as any,
    options
  );
}

export function SecuredPropertyList<
  T,
  Override extends boolean | undefined = false
>(
  valueClass: Class<T> | AbstractClassType<T> | GraphQLScalarType,
  options: SecuredPropertyListOptions<Override> = {}
) {
  return SecuredList<typeof valueClass, T, Override>(valueClass, options);
}

function SecuredList<GQL, TS, Override extends boolean | undefined = false>(
  valueClass: GQL,
  options: SecuredPropertyListOptions<Override> = {}
) {
  @ObjectType({ isAbstract: true, implements: [Readable, Editable] })
  abstract class SecuredPropertyListClass
    implements Readable, Editable, Secured<SecuredList<TS, Override>> {
    @Field(() => [valueClass], {
      nullable: options.isOverride,
    })
    readonly value: SecuredList<TS, Override>;
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
  description: SecuredProperty.descriptionFor('a float'),
})
export abstract class SecuredFloat extends SecuredProperty<number>(Float) {}

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
export abstract class SecuredDate
  implements Readable, Editable, Secured<CalendarDate> {
  @DateField({ nullable: true })
  readonly value?: CalendarDate;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}
