import { registerEnumType } from 'type-graphql';

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
});
