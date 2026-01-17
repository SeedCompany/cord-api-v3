import { debuggerIsAttached } from 'debugger-is-attached';
import { type Config } from 'jest';
import { Duration } from 'luxon';

// eslint-disable-next-line import/no-default-export
export default async (): Promise<Config> => {
  const debugging = await debuggerIsAttached();

  const base = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    setupFiles: ['./test/setup/jest.d.ts'],
    setupFilesAfterEnv: ['./src/polyfills.ts'],
    moduleNameMapper: {
      // Imports for *.edgeql files are really *.edgeql.ts files
      [`(.+)\\.edgeql$`]: '$1.edgeql.ts',
    },
  } satisfies Config;

  const e2e = {
    ...base,
    displayName: 'E2E',
    roots: ['test'],
    testRegex: '\\.e2e-spec\\.tsx?$',

    // Once for all files, can't share memory, only serialized env or on disk
    // globalSetup: './test/setup/globalSetup.ts',
    // globalTeardown: './test/setup/globalTeardown.ts',

    // Once per file.
    setupFiles: [
      ...base.setupFiles,
      // Set longer timeout.
      // Cannot be done at project level config.
      // Don't want to override cli arg or timeout set below for debugging either.
      ...(debugging ? [] : ['./test/setup/increase-timeout-for-debugging.ts']),
    ],

    // Once per file, after jest is ready.
    // Meant for DRYing test code.
    setupFilesAfterEnv: [
      ...base.setupFilesAfterEnv,
      './test/setup/faker-patches.ts',
    ],

    slowTestThreshold: 60_000,
  } satisfies Config;

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
    testTimeout: Duration.fromObject({ minutes: 1 }).toMillis(),
    // WebStorm doesn't need this as it adds the cli flag automatically.
    // I'm guessing VSCode needs it.
    ...(debugging
      ? { testTimeout: Duration.fromObject({ hours: 2 }).toMillis() }
      : {}),
  };
};
