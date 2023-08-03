import { Book } from '@seedcompany/scripture';
import { Transform } from '~/common/transform.decorator';

export const NormalizeBook = () =>
  Transform(({ value: book }) => {
    try {
      return Book.named(book).label;
    } catch (e) {
      // Let validator throw error
      return book;
    }
  });
