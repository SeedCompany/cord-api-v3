import { applyDecorators } from '@nestjs/common';
import { Field, type FieldOptions } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import { GraphQLID as IDType } from 'graphql';
import { type ResourceShape } from '~/common/resources';
import { type Variant, type VariantOf } from '../objects/concretes/variant.dto';

/**
 * A variant input field.
 * It'll be confirmed to be one of the variants of the resource given.
 * It'll be converted to the Variant object.
 */
export const VariantInputField = <
  Res extends ResourceShape<any> & { Variants: readonly Variant[] },
  Many extends undefined | true = undefined,
>(
  resource: Res,
  options: Omit<FieldOptions, 'defaultValue'> & {
    many?: Many;
    defaultValue?: Many extends true
      ? ReadonlyArray<Variant<VariantOf<Res>> | VariantOf<Res>>
      : Variant<VariantOf<Res>> | VariantOf<Res>;
  } = {},
) => {
  const { many, defaultValue, ...rest } = options;

  // Resolve default to variant object
  const resolveVariant = (value: Variant<VariantOf<Res>> | VariantOf<Res>) =>
    typeof value === 'string'
      ? resource.Variants.find((v) => v.key === value)
      : value;
  const defaultVariant = many
    ? (defaultValue as any[] | undefined)?.map(resolveVariant)
    : resolveVariant(defaultValue as VariantOf<Res>);

  return applyDecorators(
    Field(() => (many ? [IDType] : IDType), {
      // Don't put default value in schema as we are trying to keep specific
      // values out of schema, so they can be more dynamic.
      nullable: !!defaultValue,
      ...rest,
    }),
    Transform(({ value }) => {
      if (value == null) {
        return defaultVariant;
      }
      if (many && Array.isArray(value)) {
        return value.map(resolveVariant);
      }
      return resolveVariant(value);
    }),
    IsIn(resource.Variants, {
      message: ({ value }) =>
        `Variant with key "${String(value)}" was not found`,
      each: many,
    }),
  );
};
