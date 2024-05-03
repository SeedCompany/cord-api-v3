import { sep } from 'path';

const escapedSep = sep === '/' ? '\\/' : '\\\\';
const matchSrcPathInTrace = RegExp(
  `(at (?:.+ \\()?)(?:.(?!src|node_modules))+${escapedSep}(?:src${escapedSep})?`,
);

export const normalizeFramePath = (frame: string) =>
  frame
    // Convert an absolute path to path relative to src dir
    .replace(matchSrcPathInTrace, (_, group1) => group1)
    // Convert windows paths to unix for consistency
    .replace(/\\\\/, '/');
