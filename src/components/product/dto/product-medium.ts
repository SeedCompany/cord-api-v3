import { registerEnumType } from 'type-graphql';

export enum ProductMedium {
  Print = 'print',
  Web = 'web',
  EBook = 'ebook',
  App = 'app',
  Audio = 'audio',
  OralTranslation = 'oral_translation',
  Video = 'video',
  Other = 'other',
}

registerEnumType(ProductMedium, {
  name: 'ProductMedium',
});
