// @ts-check
/** @type {import('lint-staged').Configuration} */
export default {
  '**/*.{js,mjs,ts}': (files) => {
    const lint = `yarn eslint --fix --max-warnings 0 --report-unused-disable-directives-severity=off ${files.join(' ')}`;
    const prettier = `yarn prettier --write ${files.join(' ')}`;
    return [prettier, lint];
  },
};
