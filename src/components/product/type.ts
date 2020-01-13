import { Bible, BibleBook } from './bible-book';

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

// Want to give extra props to enum, this is the only way.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ProductType {
  // False positive
  /* eslint-disable @typescript-eslint/no-unnecessary-qualifier */
  export const SpecialTypes: ProductType[] = [
    ProductType.BibleStories,
    ProductType.JesusFilm,
    ProductType.Songs,
    ProductType.LiteracyMaterials,
  ];
  /* eslint-enable @typescript-eslint/no-unnecessary-qualifier */
}

export const fromBooks = (books: BibleBook[]): ProductType | null => {
  if (!Array.isArray(books) || books.length === 0) {
    return null;
  }
  if (books.length === Bible.Full.length) {
    return ProductType.FullBible;
  }
  if (books.length === 1 && Bible.Gospels.includes(books[0])) {
    return ProductType.Gospel;
  }
  if (books.every(book => Bible.NewTestament.includes(book))) {
    return books.length === Bible.NewTestament.length
      ? ProductType.NewTestamentFull
      : ProductType.NewTestamentPortions;
  }
  if (books.every(book => Bible.OldTestament.includes(book))) {
    return books.length === Bible.OldTestament.length
      ? ProductType.OldTestamentFull
      : ProductType.OldTestamentPortions;
  }

  return ProductType.IndividualBooks;
};

export const booksFromType = (type: ProductType): BibleBook[] | null => {
  if (type === ProductType.Genesis) {
    return [BibleBook.Genesis];
  }
  if (type === ProductType.FullBible) {
    return Bible.Full;
  }
  if (type === ProductType.NewTestamentFull) {
    return Bible.NewTestament;
  }
  if (type === ProductType.OldTestamentFull) {
    return Bible.OldTestament;
  }
  if (type === ProductType.JesusFilm) {
    return [BibleBook.Luke];
  }

  return null;
};
