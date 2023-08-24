import type { Config } from '@jest/types';
import { debuggerIsAttached } from 'debugger-is-attached';
import { Duration } from 'luxon';

// eslint-disable-next-line import/no-default-export
export default async (): Promise<Config.InitialOptions> => {
  const debugging = await debuggerIsAttached();

  const base = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    setupFiles: ['./test/jest.d.ts'],
    setupFilesAfterEnv: ['./src/polyfills.ts'],
  } satisfies Config.InitialProjectOptions;

  const e2e = {
    ...base,
    displayName: 'E2E',
    roots: ['test'],
    testRegex: '\\.e2e-spec\\.tsx?$',
    setupFiles: [
      ...base.setupFiles,
      // Set longer timeout.
      // Cannot be done at project level config.
      // Don't want to override cli arg or timeout set below for debugging either.
      ...(debugging ? [] : ['./test/jest-setup.ts']),
    ],
    slowTestThreshold: 60_000,
  } satisfies Config.InitialProjectOptions;

  return {
    ...base,
    projects: [
      {
        ...base,
        displayName: 'Unit',
        roots: ['src'],
      },
      e2e,
    ],
    // WebStorm doesn't need this as it adds the cli flag automatically.
    // I'm guessing VSCode needs it.
    ...(debugging
      ? { testTimeout: Duration.fromObject({ hours: 2 }).toMillis() }
      : {}),
  };
};
