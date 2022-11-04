import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { entries, IdField, ResourceShape } from '~/common';
import { Role } from '../../authorization';

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
    map: Record<VKey, Omit<Variant, 'key'>>
  ): ReadonlyArray<Variant<VKey>> {
    return entries(map).map(([key, val]) => ({ key, ...val }));
  }
}

export type VariantKeyOf<T> = T extends Variant<infer K> ? K : never;

export type VariantOf<TResourceStatic extends ResourceShape<any>> =
  TResourceStatic extends { Variants: ReadonlyArray<Variant<infer VariantKey>> }
    ? VariantKey
    : never;
