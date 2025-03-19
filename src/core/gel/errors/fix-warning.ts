import { GelError } from 'gel';
import { ErrorAttr as Attr } from 'gel/dist/errors/base.js';

/**
 * Warnings only have a single character currently.
 * The pretty print code which prints the query needs the start & end on
 * both line & column.
 * And uses the utf16Column* attrs.
 * Set these so we get query src in error messages.
 *
 * It also has a bug where the first line is used.
 * If there is no char detected at the given position, drop the attributes.
 *
 * Also, empty lines aren't accounted for, so we have to restore those.
 */
export const fixWarningQuerySnippet = (e: GelError) => {
  // @ts-expect-error it is a private field
  const attrs: Map<Attr, number> = e._attrs;
  const lineStart = attrs.get(Attr.lineStart)!;
  const columnStart = attrs.get(Attr.columnStart)!;
  const query = (e as any)._query as string;
  const queryLines = query.split('\n');

  let emptyLinesUntilStart = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < lineStart + emptyLinesUntilStart; i++) {
    if (queryLines[i].trim() === '') {
      ++emptyLinesUntilStart;
    }
  }
  const fixedStart = lineStart + emptyLinesUntilStart;

  const char = queryLines[fixedStart - 1].charAt(columnStart - 1);
  if (!char) {
    attrs.delete(Attr.lineStart);
    attrs.delete(Attr.columnStart);
    return;
  }

  attrs.set(Attr.lineStart, fixedStart);
  attrs.set(Attr.lineEnd, fixedStart);
  attrs.set(Attr.utf16ColumnStart, columnStart - 1);
  attrs.set(Attr.utf16ColumnEnd, columnStart);
};
