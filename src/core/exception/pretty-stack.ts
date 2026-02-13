import addIndent from 'indent-string';
import { sep } from 'node:path';
import { getCauseList } from '~/common/functions';

export const prettyStack = (ex: Error, { relativePaths = true } = {}) =>
  getCauseList(ex)
    .map((e) =>
      (e.stack ?? e.message)
        .split('\n')
        .filter(isSrcFrame)
        .map((frame: string) =>
          relativePaths ? normalizeFramePath(frame) : frame,
        )
        .join('\n'),
    )
    .map((e, i) => addIndent(i > 0 ? `[cause]: ${e}` : e, i * 2))
    .join('\n');

const isSrcFrame = (frame: string) =>
  frame.startsWith('    at ')
    ? !frame.includes('node_modules') &&
      !frame.includes('(internal/') &&
      !frame.includes('(node:') &&
      !frame.includes('(<anonymous>)')
    : true;

const normalizeFramePath = (frame: string) =>
  frame
    // Convert an absolute path to path relative to src dir
    .replace(matchSrcPathInTrace, (_, group1) => group1)
    // Convert windows paths to unix for consistency
    .replace(/\\\\/, '/');

const escapedSep = sep === '/' ? '\\/' : '\\\\';
const matchSrcPathInTrace = RegExp(
  `(at (?:.+ \\()?)(?:.(?!src|node_modules))+${escapedSep}(?:src${escapedSep})?`,
);
