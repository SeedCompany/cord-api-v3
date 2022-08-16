import { parseScripture } from './parser';

describe('parseScripture', () => {
  it.each([
    ['Genesis 1', ['Genesis', 1, 1, 'Genesis', 1, 31]],
    ['Genesis 1:1', ['Genesis', 1, 1, 'Genesis', 1, 1]],
    ['Genesis 1-2', ['Genesis', 1, 1, 'Genesis', 2, 25]],
    ['Genesis 1–2', ['Genesis', 1, 1, 'Genesis', 2, 25]],
    ['Genesis 1 - 2', ['Genesis', 1, 1, 'Genesis', 2, 25]],
    ['Gen.  1-2', ['Genesis', 1, 1, 'Genesis', 2, 25]],
    ['Gen.1-2', ['Genesis', 1, 1, 'Genesis', 2, 25]],
    ['Gen1-2', ['Genesis', 1, 1, 'Genesis', 2, 25]],
    ['Genesis 3:5-20', ['Genesis', 3, 5, 'Genesis', 3, 20]],
    ['Genesis 3-6:20', ['Genesis', 3, 1, 'Genesis', 6, 20]],
    ['Genesis 3:5-6:20', ['Genesis', 3, 5, 'Genesis', 6, 20]],
    ['1 John 3-4', ['1 John', 3, 1, '1 John', 4, 21]],
    ['1 John 3, 4', ['1 John', 3, 1, '1 John', 4, 21]],
    [
      'I John 3, 5',
      ['1 John', 3, 1, '1 John', 3, 24],
      ['1 John', 5, 1, '1 John', 5, 21],
    ],
    [
      'Luke 1 and Matthew 1, 3',
      ['Matthew', 1, 1, 'Matthew', 1, 25],
      ['Matthew', 3, 1, 'Matthew', 3, 17],
      ['Luke', 1, 1, 'Luke', 1, 80],
    ],
    [
      'luke 1 AND matthew 1',
      ['Matthew', 1, 1, 'Matthew', 1, 25],
      ['Luke', 1, 1, 'Luke', 1, 80],
    ],
    ['Matthew 3 - Luke 2', ['Matthew', 3, 1, 'Luke', 2, 52]],
    [
      'Matthew 1, 5 - Luke 2',
      ['Matthew', 1, 1, 'Matthew', 1, 25],
      ['Matthew', 5, 1, 'Luke', 2, 52],
    ],
    [
      'Genesis 1, 2:3-3:4, 6-8, 9:3',
      ['Genesis', 1, 1, 'Genesis', 1, 31],
      ['Genesis', 2, 3, 'Genesis', 3, 4],
      ['Genesis', 6, 1, 'Genesis', 8, 22],
      ['Genesis', 9, 3, 'Genesis', 9, 3],
    ],
    [
      'Genesis 9:18-28; 19  :  31  -  38',
      ['Genesis', 9, 18, 'Genesis', 9, 28],
      ['Genesis', 19, 31, 'Genesis', 19, 38],
    ],

    [''],
    [' '],
    [' and '],
  ])('%s', (input, ...refs) => {
    expect(parseScripture(input)).toEqual(
      refs.map((ref) => ({
        start: { book: ref[0], chapter: ref[1], verse: ref[2] },
        end: { book: ref[3], chapter: ref[4], verse: ref[5] },
      }))
    );
  });

  it.each([
    ['Opinions 1', 'Book "Opinions" does not exist'],
    ['Genesis 100', 'Chapter 100 of Genesis does not exist'],
    ['Genesis 1-100', 'Chapter 100 of Genesis does not exist'],
    ['Genesis 1:100', 'Verse 100 of Genesis 1 does not exist'],
    ['Genesis 1-2:100', 'Verse 100 of Genesis 2 does not exist'],
    [
      '1-1',
      'Cannot parse partial reference without previous complete reference',
    ],
  ])('%s', (input, error) => {
    expect(() => parseScripture(input)).toThrowError(error);
  });
});
