// @ts-check
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
];

/** @type {import('@seedcompany/eslint-plugin').ImportRestriction[]} */
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
  {
    importNames: 'IntersectionType',
    path: '@nestjs/graphql',
    replacement: { importName: 'IntersectTypes', path: '~/common' },
    message: 'Use our wrapper that allows for varargs & provides members array',
  },
  {
    importNames: 'Subscription',
    path: '@nestjs/graphql',
    message: 'Use our wrapper that provides sanity',
    replacement: { path: '~/common' },
  },
  {
    importNames: 'HttpAdapterHost',
    path: '@nestjs/core',
    replacement: { path: '~/core/http' },
  },
  {
    importNames: ['NestMiddleware', 'NestModule'],
    path: '@nestjs/common',
    message: 'Do not use express/connect middleware',
  },
  {
    importNames: ['RouteConfig', 'RouteConstraints'],
    path: '@nestjs/platform-fastify',
    replacement: { path: '~/core/http' },
  },
  {
    path: 'type-fest',
    kind: 'value',
    message: 'Be sure to specify the `type` modifier',
  },
  {
    importNames: ['ResultOf', 'VariablesOf'],
    path: '@graphql-typed-document-node/core',
    replacement: { path: '~/graphql' },
  },
  {
    importNames: ['FragmentOf', 'ResultOf', 'VariablesOf'],
    path: 'gql.tada',
    replacement: { path: '~/graphql' },
  },
  {
    path: '@seedcompany/data-loader',
    replacement: { path: '~/core/data-loader' },
    message: 'Reference from core instead to keep loose coupling',
  },
  {
    path: '@seedcompany/nest/hooks',
    replacement: { path: '~/core/hooks' },
    message: 'Reference from core instead to keep loose coupling',
  },
  {
    path: '@seedcompany/nest/broadcast',
    importNames: ['Broadcaster', 'BroadcastChannel', 'BroadcastEvents'],
    replacement: { path: '~/core/broadcast' },
    message: 'Reference from core instead to keep loose coupling',
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
  {
    selector: 'memberLike',
    modifiers: ['readonly', 'static'],
    format: ['camelCase', 'PascalCase'],
    leadingUnderscore: 'forbid',
  },
  // allow `__typename` exception since it's a GQL standard.
  {
    selector: 'property',
    filter: '__typename',
    format: null,
  },
  // allow exceptions for gel query builder
  {
    selector: 'objectLiteralProperty',
    filter: 'filter_single',
    format: null,
  },
  {
    selector: 'objectLiteralProperty',
    filter: 'order_by',
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
  {
    selector: 'parameter',
    modifiers: ['destructured'],
    format: ['camelCase', 'UPPER_CASE'],
  },
];

/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
const config = {
  root: true,
  plugins: ['@seedcompany', 'typescript-sort-keys', 'no-only-tests'],
  extends: ['plugin:@seedcompany/nestjs'],
  rules: {
    'no-console': 'error',
    'no-only-tests/no-only-tests': 'error',
    '@typescript-eslint/naming-convention': ['warn', ...namingConvention],
    'no-restricted-imports': ['error', { paths: oldRestrictedImports }],
    '@seedcompany/no-restricted-imports': ['error', ...restrictedImports],
    'no-restricted-syntax': [
      'error',
      ...baseConfig.rules['no-restricted-syntax']?.slice(1),
      {
        selector: 'NewExpression[callee.name="Logger"]',
        message: `
        Inject a logger instead

        constructor(
          @Logger('name') private logger: ILogger
        ) {}
        `,
      },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/consistent-type-exports': [
      'error',
      { fixMixedExportsWithInlineTypeSpecifier: true },
    ],
    // TODO Enable this and fix errors (both types & logic changes will be needed)
    // Remaining errors probably need individual thought.
    // ESLint 9.24 allows bulk suppression,
    // which we can use to enable this, and handle those cases one by one.
    '@typescript-eslint/no-unnecessary-condition': 'off',

    // Allow unused session while we migrate
    '@seedcompany/no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '(^_|^session$)',
        varsIgnorePattern: '^_',
      },
    ],
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
    {
      files: './src/core/gel/generator/*.ts',
      rules: {
        // Scripts can use the console for logging
        'no-console': 'off',
      },
    },
    {
      files: './dbschema/seeds/*.ts',
      rules: {
        'import/no-default-export': 'off',
        // 'import/no-named-export': 'error',
      },
    },
  ],
};

module.exports = config;
