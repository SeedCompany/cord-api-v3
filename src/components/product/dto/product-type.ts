import { registerEnumType } from '@nestjs/graphql';

export enum ProductType {
  // Special Types
  BibleStories = 'BibleStories',
  JesusFilm = 'JesusFilm',
  Songs = 'Songs',
  LiteracyMaterials = 'LiteracyMaterials',
  EthnoArts = 'EthnoArts',

  // Normal Types (can be assumed from books)
  OldTestamentPortions = 'OldTestamentPortions',
  OldTestamentFull = 'OldTestamentFull',
  Gospel = 'Gospel',
  NewTestamentPortions = 'NewTestamentPortions',
  NewTestamentFull = 'NewTestamentFull',
  FullBible = 'FullBible',
  IndividualBooks = 'IndividualBooks',
  Genesis = 'Genesis',
}

registerEnumType(ProductType, {
  name: 'ProductType',
});
