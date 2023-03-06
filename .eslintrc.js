const baseConfig = require('@seedcompany/eslint-plugin').configs.base;

const oldRestrictedImports = [
  {
    name: '@nestjs/common',
    importNames: [
      'BadRequestException',
      'HttpException',
      'UnauthorizedException',
      'MethodNotAllowedException',
      'NotFoundException',
      'ForbiddenException',
      'NotAcceptableException',
      'RequestTimeoutException',
      'ConflictException',
      'GoneException',
      'PayloadTooLargeException',
      'UnsupportedMediaTypeException',
      'UnprocessableEntityException',
      'InternalServerErrorException',
      'NotImplementedException',
      'HttpVersionNotSupportedException',
      'BadGatewayException',
      'ServiceUnavailableException',
      'GatewayTimeoutException',
    ],
    message: 'Use our exceptions in common folder instead',
  },
  {
    name: 'lodash',
    importNames: ['Dictionary', 'NumericDictionary', 'AnyKindOfDictionary'],
    message: 'Use a type with strict keys instead',
  },
  {
    name: 'ts-essentials',
    importNames: ['Dictionary', 'SafeDictionary'],
    message: 'Use a type with strict keys instead',
  },
  {
    name: 'express-serve-static-core',
    importNames: ['Dictionary'],
    message: 'Use a type with strict keys instead',
  },
  {
    name: 'dataloader',
    message: 'Import DataLoader from our core folder instead',
  },
];

/** @type import('@seedcompany/eslint-plugin').ImportRestriction[] */
const restrictedImports = [
  // Guard against ts hints trying to insert "src/" paths.
  // It does that with basePath configured which is required for path aliases, even though it's never what we want.
  {
    path: 'src/common',
    replacement: { path: '~/common' },
  },
  {
    pattern: 'src/common/*',
    replacement: { path: '~/common/{path}' },
  },
  {
    path: 'src/core',
    replacement: { path: '~/core' },
  },
  {
    pattern: 'src/core/*',
    replacement: { path: '~/core/{path}' },
  },
  {
    pattern: 'src/*',
    message: 'Use relative import instead',
  },
  {
    path: ['..', '../..', '../../..'],
    message: 'Not specific enough',
  },
];

const namingConvention = [
  {
    selector: 'typeLike',
    format: ['PascalCase'],
  },
  // Forbid I prefixed type names
  {
    selector: 'interface',
    format: ['PascalCase'],
    custom: { regex: '^I[A-Z].+$', match: false },
  },
  {
    selector: 'memberLike',
    format: ['camelCase'],
    leadingUnderscore: 'forbid',
  },
  // allow `__typename` exception since it's a GQL standard.
  {
    selector: 'property',
    filter: '__typename',
    format: null,
  },
  // Allow object literal keys to be anything if they are in quotes
  // Used mainly by cypher query builder
  {
    selector: 'objectLiteralProperty',
    modifiers: ['requiresQuotes'],
    format: null,
  },
  {
    selector: 'property',
    format: ['camelCase', 'PascalCase'],
    leadingUnderscore: 'forbid',
  },
  {
    selector: 'enumMember',
    format: ['PascalCase', 'UPPER_CASE'],
    leadingUnderscore: 'forbid',
  },
  {
    selector: 'parameter',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
  },
];

/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
const config = {
  root: true,
  plugins: [
    '@seedcompany',
    'typescript-sort-keys',
    'no-only-tests',
  ],
  extends: ['plugin:@seedcompany/nestjs'],
  rules: {
    'no-console': 'error',
    'no-only-tests/no-only-tests': 'error',
    '@typescript-eslint/naming-convention': ['warn', ...namingConvention],
    'no-restricted-imports': ['error', { 'paths': oldRestrictedImports }],
    '@seedcompany/no-restricted-imports': ['error', ...restrictedImports],
    'no-restricted-syntax': [
      'error',
      ...baseConfig.rules['no-restricted-syntax']?.slice(1),
      {
        selector: 'NewExpression[callee.name="Logger"]',
        'message': `
        Inject a logger instead

        constructor(
          @Logger('name') private logger: ILogger
        ) {}
        `,
      },
    ],
    // TODO Enable this and fix errors (both types & logic changes will be needed)
    '@typescript-eslint/no-unnecessary-condition': 'off',
  },
  overrides: [
    {
      files: './src/core/database/query-augmentation/*.ts',
      rules: {
        // This is enforced to treat functions arguments as contravariant instead of bivariant.
        // This doesn't matter here as this class won't be overridden.
        // Declaring them as methods keeps their color the same as the rest of the query methods.
        '@typescript-eslint/method-signature-style': 'off',
      },
    },
  ],
};

module.exports = config;
