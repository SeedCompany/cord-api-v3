import { relative, resolve } from 'path';

/**
 * Modifies error stack to skip given filepath when determining
 * which source to show for given error.
 *
 * Just modifies the file location in stack so it's relative to node_modules.
 * This makes Jest's reporter skip it because it thinks it's a library file.
 * It's still a valid path though so when its displayed, relative to rootDir,
 * it looks normal.
 */
export const jestSkipFileInExceptionSource = (e: Error, filepath: string) => {
  const isTestRun = !!(global as any).jasmine;
  const isError = e instanceof Error;
  if (!isTestRun || !isError) {
    return e;
  }
  const relativePath = relative(projectRoot, filepath);
  const maskedPath = `${projectRoot}/node_modules/../${relativePath}`;
  e.stack = e.stack?.replace(filepath, maskedPath);

  return e;
};

const projectRoot = resolve(__dirname, '../..');
