import { Transform } from '../../../common/transform.decorator';
import { Book } from '../books';
import { ScriptureReferenceInput } from './scripture-reference.dto';

export const ScriptureStart = () =>
  Transform((ref: ScriptureReferenceInput) => ({
    book: ref.book,
    chapter: ref.chapter ?? 1,
    verse: ref.verse ?? 1,
  }));

export const ScriptureEnd = () =>
  Transform((ref: ScriptureReferenceInput) => {
    try {
      const book = Book.find(ref.book);
      const chapter = ref.chapter
        ? book.chapter(ref.chapter)
        : book.lastChapter;
      const verse = ref.verse ? chapter.verse(ref.verse) : chapter.lastVerse;
      return verse.reference;
    } catch (e) {
      return ref; // if reference isn't valid let validator throw the error
    }
  });
