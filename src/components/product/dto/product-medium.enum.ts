import { ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

/**
 * How the product is delivered.
 *
 * This is independent of how the translation is done.
 */
export type ProductMedium = EnumType<typeof ProductMedium>;
export const ProductMedium = makeEnum({
  name: 'ProductMedium',
  description: stripIndent`
    How the product is delivered?

    This is independent of how the translation is done.
  `,
  values: [
    'Print',
    'Web',
    { value: 'EBook', label: 'E-Book' },
    'App',
    'TrainedStoryTellers',
    'Audio',
    'Video',
    'Other',
  ],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product mediums'),
})
export class SecuredProductMediums extends SecuredEnumList(ProductMedium) {}
