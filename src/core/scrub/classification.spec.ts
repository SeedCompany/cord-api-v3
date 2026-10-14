import { describe, expect, it } from '@jest/globals';
import {
  auditAgainst,
  auditClassification,
  classification,
  columnsOf,
  isTruncate,
  needsDecision,
  type TableAction,
  walkSchema,
} from './classification';
import { NAME_POOLS } from './entity-name';
import { classificationHash, hashDecisions } from './provenance';

/**
 * The allowlist is only an allowlist if something fails when it is incomplete.
 * This is that something: it walks the real Drizzle schema, so a column added
 * to any table without a decision here fails CI rather than shipping
 * unclassified into the next refresh.
 */
describe('scrub classification', () => {
  const tables = walkSchema();

  it('covers every free-text column of every table, with no open questions', () => {
    expect(auditClassification()).toEqual([]);
  });

  it('is guarding something: the schema has free-text columns to decide about', () => {
    // A walk that found nothing would pass the audit vacuously.
    const decided = tables.flatMap((t) => t.columns.filter(needsDecision));
    expect(tables.length).toBeGreaterThan(50);
    expect(decided.length).toBeGreaterThan(60);
  });

  describe('refuses', () => {
    // Negative controls: the audit must fail on each way the file can be
    // wrong, or a green run proves nothing.
    const without = (table: keyof typeof classification, column: string) => {
      const action = classification[table];
      if (isTruncate(action)) throw new Error('pick a kept table');
      const { [column]: _dropped, ...columns } = columnsOf(action);
      const decisions: Record<string, TableAction> = {
        ...classification,
        [table]: { columns },
      };
      return decisions;
    };

    it('a free-text column nobody classified', () => {
      const problems = auditAgainst(without('users', 'email'), tables);
      expect(problems).toEqual([expect.stringContaining('users.email')]);
    });

    it('a column that no longer exists', () => {
      const decisions = {
        ...classification,
        users: {
          columns: {
            ...(classification.users as { columns: object }).columns,
            nickname: { kind: 'safe', why: 'gone' },
          },
        },
      } as unknown as Record<string, TableAction>;
      expect(auditAgainst(decisions, tables)).toEqual([
        expect.stringContaining('"nickname"'),
      ]);
    });

    it('an unresolved review', () => {
      const decisions = {
        ...classification,
        posts: {
          columns: {
            ...(classification.posts as { columns: object }).columns,
            body: { kind: 'review', question: 'is this prose?' },
          },
        },
      } as unknown as Record<string, TableAction>;
      expect(auditAgainst(decisions, tables)).toEqual([
        expect.stringMatching(/posts\.body is still marked for review/),
      ]);
    });

    it('a perType routing that misses an enum value', () => {
      const decisions = {
        ...classification,
        fileNodes: {
          columns: {
            ...(classification.fileNodes as { columns: object }).columns,
            name: { kind: 'perType', by: 'type', types: { File: 'fileName' } },
          },
        },
      } as unknown as Record<string, TableAction>;
      const problems = auditAgainst(decisions, tables);
      expect(problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`type = 'Directory' is not routed`),
          expect.stringContaining(`type = 'FileVersion' is not routed`),
        ]),
      );
    });

    it('richText on a text column, and plain prose on a jsonb column', () => {
      const decisions = {
        ...classification,
        posts: {
          columns: {
            ...(classification.posts as { columns: object }).columns,
            body: { kind: 'scrub', as: 'richText' },
          },
        },
        comments: { columns: { body: { kind: 'scrub', as: 'prose' } } },
      } as unknown as Record<string, TableAction>;
      expect(auditAgainst(decisions, tables)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('posts.body: richText is only for json'),
          expect.stringContaining(
            'comments.body: a json/jsonb column can only be scrubbed as richText',
          ),
        ]),
      );
    });
  });

  it('empties exactly the secret-bearing tables and the audit trail', () => {
    // Pinned, so a `truncate` slipped onto a data table is noticed in review.
    const truncated = Object.entries(classification)
      .filter(([, action]) => isTruncate(action))
      .map(([key]) => key)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(truncated).toEqual([
      'authPasswordResetTokens',
      'authSessions',
      'broadcastChannels',
      'resourceMutations',
      'webhookChannelObservations',
      'webhookExecutors',
      'webhooks',
    ]);
  });

  it('uses the credential strategy on the password hash and nowhere else', () => {
    const credentialed = Object.entries(classification).flatMap(
      ([table, action]) =>
        isTruncate(action)
          ? []
          : Object.entries(action.columns)
              .filter(([, c]) => c?.kind === 'scrub' && c.as === 'credential')
              .map(([column]) => `${table}.${column}`),
    );
    expect(credentialed).toEqual(['authIdentities.passwordHash']);
  });

  it('routes every pooled name strategy it uses to a pool with entries', () => {
    const used = new Set<string>();
    for (const action of Object.values(classification)) {
      if (isTruncate(action)) continue;
      for (const column of Object.values(action.columns)) {
        if (column?.kind === 'scrub') used.add(column.as);
        if (column?.kind === 'perType')
          Object.values(column.types).forEach((s) => used.add(s));
      }
    }
    const themed = [...used].filter((s) => s in NAME_POOLS);
    expect(themed.length).toBeGreaterThanOrEqual(10);
    for (const strategy of themed) {
      expect(
        NAME_POOLS[strategy as keyof typeof NAME_POOLS].length,
      ).toBeGreaterThan(0);
    }
  });

  describe('the decisions hash', () => {
    it('is stable across calls', () => {
      expect(classificationHash()).toBe(classificationHash());
      expect(classificationHash()).toMatch(/^[0-9a-f]{16}$/);
    });

    it('changes when a decision changes, and not when key order does', () => {
      const reversed = Object.fromEntries(
        Object.entries(classification).reverse(),
      );
      expect(hashDecisions(reversed)).toBe(classificationHash());

      const reclassified = {
        ...classification,
        posts: {
          columns: {
            ...(classification.posts as { columns: object }).columns,
            body: { kind: 'safe', why: 'changed' },
          },
        },
      } as unknown as Record<string, TableAction>;
      expect(hashDecisions(reclassified)).not.toBe(classificationHash());
    });
  });
});
