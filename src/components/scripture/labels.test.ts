import { labelOfScriptureRanges } from './labels';
import { parseScripture } from './parser';

describe('labels', () => {
  it.each([
    ['Genesis 1'],
    ['Genesis 1:1'],
    ['Genesis 1:1, 1:3, 1:5, 1:7'],
    ['Genesis 1–2'],
    ['Genesis 3:5–20'],
    ['Genesis 3:5–6:20'],
    ['1 John 3–5'],
    ['1 John 3, 5'],
    ['Matthew 1, Matthew 3, and Luke 1'],
    ['Matthew 3–Luke 2'],
    ['Matthew 1 and Matthew 5–Luke 2'],
    ['Genesis 1, 2:3–3:4, 6–8, 9:3'],
    ['Genesis 9:18–9:28, 19:31–19:38'],
  ])('%s', (input) => {
    expect(labelOfScriptureRanges(parseScripture(input))).toEqual(input);
  });
});
