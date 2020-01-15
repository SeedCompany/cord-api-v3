import { registerEnumType } from 'type-graphql';

export enum ProductType {
  // Special Types
  BibleStories = 'bible_stories',
  JesusFilm = 'jesus_film',
  Songs = 'songs',
  LiteracyMaterials = 'literacy_materials',

  // Normal Types (can be assumed from books)
  OldTestamentPortions = 'ot_portions',
  OldTestamentFull = 'ot_full',
  Gospel = 'a_gospel',
  NewTestamentPortions = 'nt_portions',
  NewTestamentFull = 'nt_full',
  FullBible = 'full_bible',
  IndividualBooks = 'individual_books',
  Genesis = 'genesis',
}

registerEnumType(ProductType, {
  name: 'ProductType',
});
