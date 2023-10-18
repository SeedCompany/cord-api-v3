import { Book } from '@seedcompany/scripture';
import { difficultyOfBook } from './book-difficulty-factor';

test.each([...Book])(`difficultyOfBook is defined: %s`, (book) => {
  expect(difficultyOfBook(book)).toBeDefined();
});
