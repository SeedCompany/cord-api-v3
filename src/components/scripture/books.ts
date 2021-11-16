import { LazyGetter as Once } from 'lazy-get-decorator';
import { random, range, sumBy } from 'lodash';
import { inspect } from 'util';
import { ArrayItem, iterate, NotFoundException } from '../../common';
import { ScriptureReference } from './dto';

const generateOrdinalNameVariations = (ordinal: 1 | 2 | 3, names: string[]) => {
  const ordinalMap = {
    1: ['1', 'I', 'First'],
    2: ['2', 'II', 'Second'],
    3: ['3', 'III', 'Third'],
  };
  return names.flatMap((name) =>
    ordinalMap[ordinal].flatMap((numeral) => [
      numeral + ' ' + name,
      numeral + name,
    ])
  );
};

const books = [
  {
    names: 'Genesis Ge Gen'.split(' '),
    chapters: [
      31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33,
      38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43,
      36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26,
    ],
  },
  {
    names: 'Exodus Ex Exo'.split(' '),
    chapters: [
      22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27,
      25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38,
      29, 31, 43, 38,
    ],
  },
  {
    names: 'Leviticus Le Lev'.split(' '),
    chapters: [
      17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37,
      27, 24, 33, 44, 23, 55, 46, 34,
    ],
  },
  {
    names: 'Numbers Nu Num'.split(' '),
    chapters: [
      54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32,
      22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13,
    ],
  },
  {
    names: 'Deuteronomy Dt Deut Deu De'.split(' '),
    chapters: [
      46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22,
      21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12,
    ],
  },
  {
    names: 'Joshua Js Jos Jos Josh'.split(' '),
    chapters: [
      18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28,
      51, 9, 45, 34, 16, 33,
    ],
  },
  {
    names: 'Judges Jg Jdg Ju Jdgs Judg'.split(' '),
    chapters: [
      36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31,
      30, 48, 25,
    ],
  },
  {
    names: 'Ruth Ru Rut'.split(' '),
    chapters: [22, 23, 18, 22],
  },
  {
    names: generateOrdinalNameVariations(1, 'Samuel Sam'.split(' ')),
    chapters: [
      28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30,
      24, 42, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13,
    ],
  },
  {
    names: generateOrdinalNameVariations(2, 'Samuel Sam'.split(' ')),
    chapters: [
      27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33,
      43, 26, 22, 51, 39, 25,
    ],
  },
  {
    names: generateOrdinalNameVariations(
      1,
      'Kings Ki King Kin Kngs'.split(' ')
    ),
    chapters: [
      53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46,
      21, 43, 29, 53,
    ],
  },
  {
    names: generateOrdinalNameVariations(
      2,
      'Kings Ki King Kin Kngs'.split(' ')
    ),
    chapters: [
      18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37,
      37, 21, 26, 20, 37, 20, 30,
    ],
  },
  {
    names: generateOrdinalNameVariations(
      1,
      'Chronicles Ch Chr Chron'.split(' ')
    ),
    chapters: [
      54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17,
      19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30,
    ],
  },
  {
    names: generateOrdinalNameVariations(
      2,
      'Chronicles Ch Chr Chron'.split(' ')
    ),
    chapters: [
      17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34,
      11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23,
    ],
  },
  {
    names: 'Ezra Ez Ezr'.split(' '),
    chapters: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44],
  },
  {
    names: 'Nehemiah Ne Neh Neh Ne'.split(' '),
    chapters: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31],
  },
  {
    names: 'Esther Es Est Esth Ester'.split(' '),
    chapters: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3],
  },
  {
    names: 'Job Jb Job'.split(' '),
    chapters: [
      22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21,
      29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24,
      41, 30, 24, 34, 17,
    ],
  },
  {
    names: 'Psalm Ps Psa Pss Psalms'.split(' '),
    chapters: [
      6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13,
      31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17,
      13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12,
      8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13,
      19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9,
      5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176,
      7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7,
      12, 15, 21, 10, 20, 14, 9, 6,
    ],
  },
  {
    names: 'Proverbs Pr Prov Pro'.split(' '),
    chapters: [
      33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24,
      29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31,
    ],
  },
  {
    names: 'Ecclesiastes Ec Ecc'.split(' '),
    chapters: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14],
  },
  {
    names: ['Song of Solomon', 'SOS', 'Song of Songs', 'SongOfSongs', 'Sng'],
    chapters: [17, 17, 11, 16, 16, 13, 13, 14],
  },
  {
    names: 'Isaiah Isa'.split(' '),
    chapters: [
      31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6,
      17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8,
      31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21,
      14, 21, 22, 11, 12, 19, 12, 25, 24,
    ],
  },
  {
    names: 'Jeremiah Je Jer'.split(' '),
    chapters: [
      19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23,
      15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32,
      21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34,
    ],
  },
  {
    names: 'Lamentations La Lam Lament'.split(' '),
    chapters: [22, 22, 66, 22, 22],
  },
  {
    names: 'Ezekiel Ek Ezk Ezek Eze'.split(' '),
    chapters: [
      28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14,
      49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28,
      23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35,
    ],
  },
  {
    names: 'Daniel Da Dan Dl Dnl'.split(' '),
    chapters: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13],
  },
  {
    names: 'Hosea Ho Hos'.split(' '),
    chapters: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9],
  },
  {
    names: 'Joel Jl Jol Joel Joe'.split(' '),
    chapters: [20, 32, 21],
  },
  {
    names: 'Amos Am Amos Amo'.split(' '),
    chapters: [15, 16, 15, 13, 27, 14, 17, 14, 15],
  },
  {
    names: 'Obadiah Ob Oba Obd Odbh'.split(' '),
    chapters: [21],
  },
  {
    names: 'Jonah Jh Jon Jnh'.split(' '),
    chapters: [17, 10, 10, 11],
  },
  {
    names: 'Micah Mi Mic'.split(' '),
    chapters: [16, 13, 12, 13, 15, 16, 20],
  },
  {
    names: 'Nahum Nam Na Nah Na'.split(' '),
    chapters: [15, 13, 19],
  },
  {
    names: 'Habakkuk Hb Hab Hk Habk'.split(' '),
    chapters: [17, 20, 19],
  },
  {
    names: 'Zephaniah Zp Zep Zeph Ze'.split(' '),
    chapters: [18, 15, 20],
  },
  {
    names: 'Haggai Ha Hag Hagg'.split(' '),
    chapters: [15, 23],
  },
  {
    names: 'Zechariah Zc Zech Zec'.split(' '),
    chapters: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21],
  },
  {
    names: 'Malachi Ml Mal Mlc'.split(' '),
    chapters: [14, 17, 18, 6],
  },
  {
    names: 'Matthew Mt Matt Mat'.split(' '),
    chapters: [
      25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35,
      30, 34, 46, 46, 39, 51, 46, 75, 66, 20,
    ],
  },
  {
    names: 'Mark Mk Mrk'.split(' '),
    chapters: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20],
  },
  {
    names: 'Luke Lk Luk Lu'.split(' '),
    chapters: [
      80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43,
      48, 47, 38, 71, 56, 53,
    ],
  },
  {
    names: 'John Jn Jhn Joh Jo'.split(' '),
    chapters: [
      51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40,
      42, 31, 25,
    ],
  },
  {
    names: 'Acts Ac Act'.split(' '),
    chapters: [
      26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28,
      41, 38, 40, 30, 35, 27, 27, 32, 44, 31,
    ],
  },
  {
    names: 'Romans Ro Rom Rmn Rmns'.split(' '),
    chapters: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27],
  },
  {
    names: generateOrdinalNameVariations(1, 'Corinthians Co Cor'.split(' ')),
    chapters: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  },
  {
    names: generateOrdinalNameVariations(2, 'Corinthians Co Cor'.split(' ')),
    chapters: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
  },
  {
    names: 'Galatians Ga Gal Gltns'.split(' '),
    chapters: [24, 21, 29, 31, 26, 18],
  },
  {
    names: 'Ephesians Ep Eph Ephn'.split(' '),
    chapters: [23, 22, 21, 32, 33, 24],
  },
  {
    names: 'Philippians Php Phi Phil Phi'.split(' '),
    chapters: [30, 30, 21, 23],
  },
  {
    names: 'Colossians Co Col Colo Cln Clns'.split(' '),
    chapters: [29, 23, 25, 18],
  },
  {
    names: generateOrdinalNameVariations(
      1,
      'Thessalonians Th Thess Thes'.split(' ')
    ),
    chapters: [10, 20, 13, 18, 28],
  },
  {
    names: generateOrdinalNameVariations(
      2,
      'Thessalonians Th Thess Thes'.split(' ')
    ),
    chapters: [12, 17, 18],
  },
  {
    names: generateOrdinalNameVariations(1, 'Timothy Ti Tim'.split(' ')),
    chapters: [20, 15, 16, 16, 25, 21],
  },
  {
    names: generateOrdinalNameVariations(2, 'Timothy Ti Tim'.split(' ')),
    chapters: [18, 26, 17, 22],
  },
  {
    names: 'Titus Ti Tit Tt Ts'.split(' '),
    chapters: [16, 15, 15],
  },
  {
    names: 'Philemon Phm Pm Phile Philm'.split(' '),
    chapters: [25],
  },
  {
    names: 'Hebrews He Heb Hw'.split(' '),
    chapters: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25],
  },
  {
    names: 'James Jm Jam Jas Ja'.split(' '),
    chapters: [27, 26, 18, 17, 20],
  },
  {
    names: generateOrdinalNameVariations(1, 'Peter Pe Pet P'.split(' ')),
    chapters: [25, 25, 22, 19, 14],
  },
  {
    names: generateOrdinalNameVariations(2, 'Peter Pe Pet P'.split(' ')),
    chapters: [21, 22, 18],
  },
  {
    names: generateOrdinalNameVariations(1, 'John Joh Jo Jn J'.split(' ')),
    chapters: [10, 29, 24, 21, 21],
  },
  {
    names: generateOrdinalNameVariations(2, 'John Joh Jo Jn J'.split(' ')),
    chapters: [13],
  },
  {
    names: generateOrdinalNameVariations(3, 'John Joh Jo Jn J'.split(' ')),
    chapters: [14],
  },
  {
    names: 'Jude Jud'.split(' '),
    chapters: [25],
  },
  {
    names: 'Revelation Re Rev Rvltn'.split(' '),
    chapters: [
      20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21,
      15, 27, 21,
    ],
  },
];

type BookData = ArrayItem<typeof books>;

const bookCache = new Map<string, BookData | null>();

export class Book implements Iterable<Chapter> {
  readonly #book: BookData;

  private constructor(book: BookData) {
    this.#book = book;
  }

  static first() {
    return new Book(books[0]);
  }

  static last() {
    return new Book(books[books.length - 1]);
  }

  static tryFind(name: string | null | undefined) {
    if (!name) {
      return null;
    }
    const normalizedName = name.toLowerCase();
    if (!bookCache.has(normalizedName)) {
      const book = books.find((book) =>
        book.names.map((n) => n.toLowerCase()).includes(normalizedName)
      );
      bookCache.set(normalizedName, book ?? null);
    }
    const cached = bookCache.get(normalizedName);
    return cached ? new Book(cached) : null;
  }

  static find(name: string) {
    const book = Book.tryFind(name);
    if (book) {
      return book;
    }
    throw new NotFoundException(`Book "${name}" does not exist`);
  }

  static fromRef(ref: ScriptureReference) {
    return Book.find(ref.book);
  }

  static isValid(book: string | null | undefined) {
    return !!Book.tryFind(book);
  }

  static random(after?: Book) {
    const min = after ? books.indexOf(after.#book) : 0;
    const max = books.length - 1;
    const book = books[random(min, max)];
    return new Book(book);
  }

  get label() {
    return this.name;
  }

  get name(): string {
    return this.#book.names[0];
  }

  private get index() {
    return books.indexOf(this.#book);
  }

  get isFirst() {
    return this.index === 0;
  }

  get isLast() {
    return this.index === books.length - 1;
  }

  get previous(): Book | null {
    return this.isFirst ? null : new Book(books[this.index - 1]);
  }

  get next(): Book | null {
    return this.isLast ? null : new Book(books[this.index + 1]);
  }

  get totalChapters() {
    return this.#book.chapters.length;
  }

  @Once()
  get totalVerses() {
    return sumBy(this.chapters, (chapter) => chapter.totalVerses);
  }

  get firstChapter() {
    return this.chapter(1);
  }

  get lastChapter() {
    return this.chapter(this.totalChapters);
  }

  get chapters(): Chapter[] {
    return iterate(this);
  }

  randomChapter(after?: Chapter) {
    return this.chapter(random(after?.chapter ?? 1, this.totalChapters));
  }

  chapter(chapterNumber: number) {
    const totalVerses = this.#book.chapters[chapterNumber - 1];
    if (totalVerses > 0) {
      return new Chapter(this, chapterNumber, totalVerses);
    }
    throw new NotFoundException(
      `Chapter ${chapterNumber} of ${this.label} does not exist`
    );
  }

  equals(other: Book) {
    return this.name === other.name;
  }

  static [Symbol.iterator] = function* () {
    for (const book of books) {
      yield Book.find(book.names[0]);
    }
  };

  [Symbol.iterator] = function* (this: Book) {
    for (const chapter of range(1, this.totalChapters + 1)) {
      yield this.chapter(chapter);
    }
  };

  [inspect.custom]() {
    return `[Book] ${this.label}`;
  }
}

export class Chapter implements Iterable<Verse> {
  constructor(
    readonly book: Book,
    readonly chapter: number,
    readonly totalVerses: number
  ) {}

  static first() {
    return Book.first().firstChapter;
  }

  static last() {
    return Book.last().lastChapter;
  }

  static fromRef(ref: ScriptureReference) {
    return Book.fromRef(ref).chapter(ref.chapter);
  }

  static random(after?: Chapter) {
    const book = Book.random(after?.book);
    return book.randomChapter(after?.book.equals(book) ? after : undefined);
  }

  static isValid(book: Book, chapter: number) {
    try {
      book.chapter(chapter);
      return true;
    } catch {
      return false;
    }
  }

  get label() {
    return `${this.book.label} ${this.chapter}`;
  }

  get firstVerse() {
    return this.verse(1);
  }

  get lastVerse() {
    return this.verse(this.totalVerses);
  }

  get isFirst() {
    return this.chapter === 1;
  }

  get isLast() {
    return this.chapter === this.book.totalChapters;
  }

  get previousInBook(): Chapter | null {
    return this.isFirst ? null : this.book.chapter(this.chapter - 1);
  }

  get nextInBook(): Chapter | null {
    return this.isLast ? null : this.book.chapter(this.chapter + 1);
  }

  equals(other: Chapter) {
    return this.book.equals(other.book) && this.chapter === other.chapter;
  }

  randomVerse(after?: Verse) {
    return this.verse(random(after?.verse ?? 1, this.totalVerses));
  }

  verse(verseNumber: number) {
    if (verseNumber > this.totalVerses) {
      throw new NotFoundException(
        `Verse ${verseNumber} of ${this.label} does not exist`
      );
    }
    return new Verse(this, verseNumber);
  }

  [Symbol.iterator] = function* (this: Chapter) {
    for (const verseNum of range(1, this.totalVerses + 1)) {
      yield this.verse(verseNum);
    }
  };

  get verses() {
    return iterate(this);
  }

  [inspect.custom]() {
    return `[Chapter] ${this.label}`;
  }
}

export class Verse {
  constructor(readonly chapter: Chapter, readonly verse: number) {}

  static first() {
    return Chapter.first().firstVerse;
  }

  static last() {
    return Chapter.last().lastVerse;
  }

  static fromRef(ref: ScriptureReference) {
    return Chapter.fromRef(ref).verse(ref.verse);
  }

  static fromId(verseId: number) {
    // Start by converting the 0-indexed number to the 1-indexed verse total
    let versesRemaining = verseId + 1;

    let book: Book | null = Book.first();
    while (book && versesRemaining > 0) {
      // First narrow it down to the book
      if (versesRemaining - book.totalVerses > 0) {
        versesRemaining -= book.totalVerses;
        book = book.next;
        continue;
      }

      let chapter: Chapter | null = book.firstChapter;
      while (chapter && versesRemaining > 0) {
        // Now narrow it down to the chapter
        if (versesRemaining - chapter.totalVerses > 0) {
          versesRemaining -= chapter.totalVerses;
          chapter = chapter.nextInBook;
          continue;
        }

        // With previous books & chapters removed the renaming verses
        // is the verse in the chapter & book.
        return chapter.verse(versesRemaining);
      }
    }

    throw new NotFoundException('Invalid verse number');
  }

  static random(after?: Verse) {
    const chapter = Chapter.random(after?.chapter);
    return chapter.randomVerse(
      after?.chapter.equals(chapter) ? after : undefined
    );
  }

  static isValid(chapter: Chapter, verse: number) {
    try {
      chapter.verse(verse);
      return true;
    } catch {
      return false;
    }
  }

  get book() {
    return this.chapter.book;
  }

  get label() {
    return `${this.chapter.label}:${this.verse}`;
  }

  get isFirst() {
    return this.verse === 1;
  }

  get isLast() {
    return this.verse === this.chapter.totalVerses;
  }

  equals(other: Verse) {
    return this.id === other.id;
  }

  @Once()
  get id() {
    // Verse ID is just a 0-indexed number starting from Genesis 1:1.
    // Since all verses are 1-indexed we start with the offset.
    let verseCount = -1;

    // 1. Add all verses in Bible before current book
    let book = this.book.previous;
    while (book) {
      verseCount += book.totalVerses;
      book = book.previous;
    }

    // 2. Add all verses in chapters up to current chapter
    let chapter = this.chapter.previousInBook;
    while (chapter) {
      verseCount += chapter.totalVerses;
      chapter = chapter.previousInBook;
    }

    // 3. Add all verses in current chapter including current verse
    verseCount += this.verse;

    return verseCount;
  }

  get reference() {
    return {
      book: this.chapter.book.name,
      chapter: this.chapter.chapter,
      verse: this.verse,
    };
  }

  // For comparison
  // noinspection JSUnusedGlobalSymbols
  valueOf() {
    return this.id;
  }

  // For JSON.stringify()
  toJSON() {
    return this.reference;
  }

  [inspect.custom]() {
    return `[Verse] ${this.label}`;
  }
}
