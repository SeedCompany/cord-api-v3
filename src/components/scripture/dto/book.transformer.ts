import { Transform } from '../../../common/transform.decorator';
import { Book } from '../books';

export const NormalizeBook = () =>
  Transform(({ value: book }) => {
    try {
      return Book.find(book).label;
    } catch (e) {
      // Let validator throw error
      return book;
    }
  });
