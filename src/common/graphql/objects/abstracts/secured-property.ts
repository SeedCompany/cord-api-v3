import { type Type } from '@nestjs/common';
import {
  Field,
  type FieldOptions,
  type GqlTypeReference,
  ObjectType,
} from '@nestjs/graphql';
import { type MadeEnum } from '@seedcompany/nest';
import { stripIndent } from 'common-tags';
import { type GraphQLScalarType } from 'graphql';
import type { AbstractClass, Class } from 'type-fest';
import { type Secured } from '../../types/secured';
import { ISecured } from './secured.interface';

export function SecuredEnum<
  T extends string,
  EnumValue extends string,
  Nullable extends boolean | undefined = false,
>(
  valueClass: { [key in T]: EnumValue } | MadeEnum<EnumValue>,
  options: SecuredPropertyOptions<Nullable> = {},
) {
  return InnerSecuredProperty<any, EnumValue, Nullable>(valueClass, options);
}

export function SecuredProperty<
  GqlType,
  TsType = GqlType,
  Nullable extends boolean | undefined = false,
>(
  valueClass: Class<GqlType> | AbstractClass<GqlType> | GraphQLScalarType,
  options: SecuredPropertyOptions<Nullable> = {},
) {
  return InnerSecuredProperty<typeof valueClass, TsType, Nullable>(
    valueClass,
    options,
  );
}

export interface SecuredPropertyOptions<
  Nullable extends boolean | undefined = false,
> extends Pick<FieldOptions, 'description'> {
  /** Whether the property can be null (when the requester can read) */
  nullable?: Nullable;
}

type SecuredValue<
  T,
  Nullable extends boolean | undefined,
> = Nullable extends true ? T | null : T;

function InnerSecuredProperty<
  GqlType extends GqlTypeReference,
  TsType = GqlType,
  Nullable extends boolean | undefined = false,
>(
  valueClass: GqlType,
  { nullable: _, ...options }: SecuredPropertyOptions<Nullable> = {},
) {
  @ObjectType({ isAbstract: true, implements: [ISecured] })
  abstract class SecuredPropertyClass
    implements ISecured, Secured<SecuredValue<TsType, Nullable>>
  {
    @Field(() => valueClass as Type<GqlType>, {
      ...options,
      nullable: true,
    })
    readonly value?: SecuredValue<TsType, Nullable>;
    @Field()
    readonly canRead: boolean;
    @Field()
    readonly canEdit: boolean;
  }

  return SecuredPropertyClass;
}

SecuredEnum.descriptionFor = SecuredProperty.descriptionFor = (
  value: string,
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
  Nullable extends boolean | undefined = false,
>(
  valueClass: { [key in T]: EnumValue } | MadeEnum<EnumValue>,
  options: SecuredPropertyOptions<Nullable> = {},
) {
  return SecuredList<EnumValue, EnumValue, Nullable>(
    valueClass as any,
    options,
  );
}

export function SecuredPropertyList<
  T,
  Nullable extends boolean | undefined = false,
>(
  valueClass: Class<T> | AbstractClass<T> | GraphQLScalarType,
  options: SecuredPropertyOptions<Nullable> = {},
) {
  return SecuredList<typeof valueClass, T, Nullable>(valueClass, options);
}

function SecuredList<GQL, TS, Nullable extends boolean | undefined = false>(
  valueClass: GQL,
  options: SecuredPropertyOptions<Nullable> = {},
) {
  @ObjectType({ isAbstract: true, implements: [ISecured] })
  abstract class SecuredPropertyListClass
    implements ISecured, Secured<SecuredList<TS, Nullable>>
  {
    @Field(() => [valueClass as Type<GQL>], {
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
  value: string,
) => stripIndent`
  An object whose \`value\` is a list of ${value} and has additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is empty: \`[]\`.
  These \`can*\` authorization properties are specific to the user making the request.
`;
