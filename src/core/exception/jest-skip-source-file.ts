import { dirname, relative, resolve } from 'path';
import * as stacktrace from 'stack-trace';
import { fileURLToPath } from 'url';

/**
 * Modifies error stack to skip given filepath when determining
 * which source to show for given error.
 *
 * Just modifies the file location in stack, so it is relative to node_modules.
 * This makes Jest's reporter skip it because it thinks it is a library file.
 * It is still a valid path though, so when it is displayed, relative to rootDir,
 * it looks normal.
 */
export const jestSkipFileInExceptionSource = (
  e: Error,
  filepath: string | RegExp,
) => {
  if (!process.env.JEST_WORKER_ID || !(e instanceof Error)) {
    return e;
  }

  const all = filepath instanceof RegExp ? filepath.global : true;
  e.stack = e.stack?.[all ? 'replaceAll' : 'replace'](filepath, (substr) => {
    const path = substr.match(/\s+at /)
      ? stacktrace.parse({ stack: 'Error \n' + substr } as any)[0].getFileName()
      : substr;

    const relativePath = relative(projectRoot, path);
    const maskedPath = `${projectRoot}/node_modules/../${relativePath}`;

    return substr.replace(path, maskedPath);
  });

  return e;
};

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
