import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredPropertyList } from '../../../common';

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
  Audio = 'Audio',
  OralTranslation = 'OralTranslation',
  Video = 'Video',
  Other = 'Other',
}

registerEnumType(ProductMedium, {
  name: 'ProductMedium',
  description: 'How the product is delivered',
});

@ObjectType({
  description: SecuredPropertyList.descriptionFor('product mediums'),
})
export class SecuredProductMediums extends SecuredPropertyList(ProductMedium) {}
