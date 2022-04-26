import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

/**
 * How the product is delivered.
 *
 * This is independent of how the translation is done.
 */
export enum ProductMedium {
  Print = 'Print',
  Web = 'Web',
  EBook = 'EBook',
  App = 'App',
  TrainedStoryTellers = 'TrainedStoryTellers',
  Audio = 'Audio',
  Video = 'Video',
  Other = 'Other',
}

registerEnumType(ProductMedium, {
  name: 'ProductMedium',
  description: 'How the product is delivered',
  valuesMap: {
    EBook: {
      description: `@label E-Book`,
    },
  },
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product mediums'),
})
export class SecuredProductMediums extends SecuredEnumList(ProductMedium) {}
