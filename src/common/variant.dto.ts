import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, ObjectType } from '@nestjs/graphql';
import { ID as IDType } from '@nestjs/graphql/dist/scalars';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import { stripIndent } from 'common-tags';
import { ResourceShape } from '~/common/resource.dto';
import { InputException } from './exceptions';
import { IdField } from './id-field';
import { Role } from './role.dto';
import { entries } from './util';

@ObjectType()
export class Variant<Key extends string = string> {
  @IdField({
    description: 'Use this field when communicating with the API',
  })
  key: Key;

  @Field({
    description: 'Describe the variant to users with this field',
  })
  label: string;

  @Field(() => Role, {
    nullable: true,
    description: stripIndent`
      The main role _responsible_ for values of this variant.
      This does not necessarily imply who has access to this variant's values.
      The given role could have edit access or not, and other roles could be able
      to edit this variant's values as well.
    `,
  })
  responsibleRole?: Role;

  static createList<VKey extends string>(
    map: Record<VKey, Omit<Variant, 'key'>>,
  ): VariantList<VKey> {
    const list = entries(map).map(([key, val]) => ({ key, ...val }));
    Object.defineProperty(list, 'byKey', {
      enumerable: false,
      value: (key: VKey) => {
        const found = list.find((v) => v.key === key);
        if (!found) {
          throw new InputException(
            `Variant with key "${key}" was not found`,
            'variant',
          );
        }
        return found;
      },
    });
    return list as any;
  }
}

export type VariantList<VKey extends string> = ReadonlyArray<Variant<VKey>> & {
  byKey: (key: VKey) => Variant<VKey>;
};

export type VariantKeyOf<T> = T extends Variant<infer K> ? K : never;

export type VariantOf<TResourceStatic extends ResourceShape<any>> =
  TResourceStatic extends { Variants: ReadonlyArray<Variant<infer VariantKey>> }
    ? VariantKey
    : never;

/**
 * A variant input field.
 * It'll be confirmed to be one of the variants of the resource given.
 * It'll be converted to the Variant object.
 */
export const VariantInputField = <
  Res extends ResourceShape<any> & { Variants: readonly Variant[] },
>(
  resource: Res,
  options: Omit<FieldOptions, 'defaultValue'> & {
    defaultValue?: Variant<VariantOf<Res>> | VariantOf<Res>;
  } = {},
) => {
  const { defaultValue, ...rest } = options;

  // Resolve default to variant object
  const defaultVariant =
    typeof defaultValue === 'string'
      ? resource.Variants.find((v) => v.key === options.defaultValue)
      : defaultValue;

  return applyDecorators(
    Field(() => IDType, {
      // Don't put default value in schema as we are trying to keep specific
      // values out of schema, so they can be more dynamic.
      nullable: !!defaultValue,
      ...rest,
    }),
    Transform(({ value }) => {
      if (value == null) {
        return defaultVariant;
      }
      return resource.Variants.find((v) => v.key === value) ?? value;
    }),
    IsIn(resource.Variants, {
      message: ({ value }) =>
        `Variant with key "${String(value)}" was not found`,
    }),
  );
};
