import { describe, expect, it } from '@jest/globals';
import { buildSchema, type ExecutionResult, parse } from 'graphql';
import { ReadOnlyModeException } from '~/common';
import { type ConfigService } from '~/core/config';
import { type Plugin } from './plugin.decorator';
import { ReadOnlyModePlugin } from './read-only-mode.plugin';

const makePlugin = (readOnly: boolean) =>
  new ReadOnlyModePlugin({
    maintenance: { readOnly },
  } as unknown as ConfigService);

type OnExecuteParams = Parameters<NonNullable<Plugin['onExecute']>>[0];

/**
 * Field collection only reads the ROOT selection set and the root types'
 * names, so the documents below don't need schema-valid sub-selections.
 */
const schema = buildSchema(`
  type Query { ok: Boolean }
  type Mutation { ok: Boolean }
  type Subscription { ok: Boolean }
`);

/**
 * Runs the hook against a parsed operation.
 * Returns the refusal result when the plugin replaced execution,
 * or null when it left execution alone.
 */
const execute = (
  plugin: ReadOnlyModePlugin,
  query: string,
  options: {
    operationName?: string;
    variables?: Record<string, unknown>;
  } = {},
): ExecutionResult | null => {
  let refusal: ExecutionResult | null = null;
  const params = {
    args: {
      schema,
      document: parse(query),
      operationName: options.operationName,
      variableValues: options.variables,
    },
    setExecuteFn: (fn: () => ExecutionResult) => {
      refusal = fn();
    },
  } as unknown as OnExecuteParams;
  // The hook body is synchronous; the promise in its signature is envelop's.
  void plugin.onExecute!(params);
  return refusal;
};

const expectRefused = (refusal: ExecutionResult | null) => {
  expect(refusal).not.toBeNull();
  const error = refusal!.errors![0]!;
  expect(error.originalError).toBeInstanceOf(ReadOnlyModeException);
};

describe('ReadOnlyModePlugin', () => {
  it('leaves everything alone when the mode is off', () => {
    const plugin = makePlugin(false);
    const refusal = execute(
      plugin,
      'mutation { createOrganization { organization { id } } }',
    );
    expect(refusal).toBeNull();
  });

  describe('when the mode is on', () => {
    const plugin = makePlugin(true);

    it('leaves queries alone', () => {
      const refusal = execute(plugin, 'query { session { token } }');
      expect(refusal).toBeNull();
    });

    it('leaves subscriptions alone', () => {
      const refusal = execute(plugin, 'subscription { notifications { id } }');
      expect(refusal).toBeNull();
    });

    it('refuses a mutation', () => {
      const refusal = execute(
        plugin,
        'mutation { createOrganization { organization { id } } }',
      );
      expectRefused(refusal);
    });

    it('allows signing in & out', () => {
      const login = execute(plugin, 'mutation { login { user { id } } }');
      expect(login).toBeNull();
      const logout = execute(plugin, 'mutation { logout { __typename } }');
      expect(logout).toBeNull();
    });

    it('refuses a mutation mixed in beside an allowed one', () => {
      const refusal = execute(
        plugin,
        'mutation { login { user { id } } createOrganization { organization { id } } }',
      );
      expectRefused(refusal);
    });

    it('refuses a mutation hidden behind a fragment spread', () => {
      const refusal = execute(
        plugin,
        `
          mutation Sneaky { ...writes }
          fragment writes on Mutation {
            createOrganization { organization { id } }
          }
        `,
      );
      expectRefused(refusal);
    });

    it('refuses a mutation hidden behind an inline fragment', () => {
      const refusal = execute(
        plugin,
        `
          mutation Sneaky {
            ... on Mutation {
              createOrganization { organization { id } }
            }
          }
        `,
      );
      expectRefused(refusal);
    });

    it('only judges the operation actually being executed', () => {
      const document = `
        query Reads { session { token } }
        mutation Writes { createOrganization { organization { id } } }
      `;
      expect(execute(plugin, document, { operationName: 'Reads' })).toBeNull();
      expectRefused(execute(plugin, document, { operationName: 'Writes' }));
    });

    it('allows a mutation selecting only meta fields', () => {
      const refusal = execute(plugin, 'mutation { __typename }');
      expect(refusal).toBeNull();
    });

    it('ignores a write field disabled by @skip', () => {
      const refusal = execute(
        plugin,
        `
          mutation {
            login { user { id } }
            createOrganization @skip(if: true) { organization { id } }
          }
        `,
      );
      expect(refusal).toBeNull();
    });

    it('judges a variable-driven @include by its actual value', () => {
      const document = `
        mutation ($doWrite: Boolean!) {
          login { user { id } }
          createOrganization @include(if: $doWrite) { organization { id } }
        }
      `;
      expect(
        execute(plugin, document, { variables: { doWrite: false } }),
      ).toBeNull();
      expectRefused(
        execute(plugin, document, { variables: { doWrite: true } }),
      );
    });

    it('ignores a whole fragment disabled by @skip', () => {
      const refusal = execute(
        plugin,
        `
          mutation {
            login { user { id } }
            ...writes @skip(if: true)
          }
          fragment writes on Mutation {
            createOrganization { organization { id } }
          }
        `,
      );
      expect(refusal).toBeNull();
    });
  });
});
