import { type DatabaseService } from '~/core/neo4j';
import { links, properties } from './classification';

/**
 * The independent check that the scrub worked.
 *
 * Deliberately **not** built from the scrub's own bookkeeping. A scrub that
 * silently skipped a field would report success and its own counts would agree
 * with it. This re-reads the graph and looks for values that still look real, so
 * a missed field shows up as a number rather than as silence.
 *
 * REPORTS COUNTS, NEVER VALUES. That is what makes the result safe to paste into
 * a conversation, a ticket, or a CI log: a violation names the field and how many,
 * which is everything triage needs and nothing a reader shouldn't see.
 */

export interface Violation {
  readonly field: string;
  readonly probe: string;
  readonly count: number;
}

/**
 * Patterns that indicate an unscrubbed value survived.
 *
 * Each is written to catch the shape of *real* data, not to validate the shape of
 * fake data — an inverted test would pass on an empty database.
 */
const PROBES = {
  /** Any address not on the reserved non-routable domain. */
  realEmail: {
    where: `p.value =~ '(?i).*@.*\\\\..*' AND NOT p.value ENDS WITH '@example.invalid'`,
    describes: 'email not on example.invalid',
  },
  /** Dialable numbers — the fakes all sit in the reserved 555-01xx block. */
  realPhone: {
    where: `p.value =~ '.*[0-9]{3}[^0-9]?[0-9]{4}.*' AND NOT p.value CONTAINS '555 01'`,
    describes: 'phone-shaped and not in the reserved block',
  },
  /**
   * A rich-text field NOT holding a serialized document.
   *
   * This probe started out inverted — it flagged the NUL-prefixed form as a
   * violation, reasoning that a leftover serialized value meant unscrubbed data.
   * Backwards: a correctly scrubbed rich-text field MUST still be a serialized
   * document, because that is the only shape the column can hold. So the probe
   * reported clean on genuinely broken data and would have failed on correct data.
   *
   * It now checks what actually goes wrong. When the scrub mishandled the object
   * form, every body became a bare string, the structure was lost, and the ETL
   * dropped 30 of 32 comments as unparseable — with verification reporting no
   * violations throughout. This is the probe that catches that.
   */
  nonDocumentRichText: {
    where: `NOT p.value STARTS WITH '\\u0000RichText\\u0000'`,
    describes: 'rich-text field holding a bare string, not a document',
  },
} as const;

const countFieldMatches = async (
  neo4j: DatabaseService,
  link: string,
  where: string,
): Promise<number> => {
  const rows = await neo4j
    .query<{ total: number }>(
      `MATCH ()-[:\`${link}\`]->(p)
       WHERE (p:Property OR p:Deleted_Property)
         AND p.value IS NOT NULL AND ${where}
       RETURN count(p) AS total`,
    )
    .run();
  return Number(rows[0]?.total ?? 0);
};

/**
 * Long free-text runs inside the two extraction fields left unscrubbed by
 * decision on 2026-07-31.
 *
 * Both hold machine-generated output, which is why leaving them was reasonable —
 * but templated messages interpolate the spreadsheet cells that triggered them, so
 * a fragment of real narrative could ride along. Nobody has read those values, and
 * this is how that stays true: a count of suspiciously long text runs, repeated on
 * every refresh. Zero closes the question. Non-zero is a prompt to look, without
 * this check ever surfacing what it found.
 */
const FREE_TEXT_RUN = 200;

const countLongTextRuns = async (
  neo4j: DatabaseService,
  key: string,
): Promise<number> => {
  const rows = await neo4j
    .query<{ total: number }>(
      `MATCH (n) WHERE n.\`${key}\` IS NOT NULL
         AND size(toString(n.\`${key}\`)) > $threshold
       RETURN count(n) AS total`,
      { threshold: FREE_TEXT_RUN },
    )
    .run();
  return Number(rows[0]?.total ?? 0);
};

export interface VerifyReport {
  readonly violations: readonly Violation[];
  readonly watchlist: readonly Violation[];
  readonly clean: boolean;
}

export const runVerify = async (
  neo4j: DatabaseService,
): Promise<VerifyReport> => {
  const violations: Violation[] = [];

  for (const [link, action] of Object.entries(links)) {
    if (action.kind !== 'scrub') continue;

    // Match each probe to the fields it can actually judge. Running every probe
    // against every field would generate noise that trains people to ignore the
    // report, which is worse than not having one.
    const applicable: Array<keyof typeof PROBES> = [];
    if (action.as === 'email') applicable.push('realEmail');
    if (action.as === 'phone') applicable.push('realPhone');
    if (action.as === 'richText') applicable.push('nonDocumentRichText');

    for (const probe of applicable) {
      const count = await countFieldMatches(neo4j, link, PROBES[probe].where);
      if (count > 0) {
        violations.push({
          field: `${link} (link)`,
          probe: PROBES[probe].describes,
          count,
        });
      }
    }
  }

  // Anything the classification says to delete must genuinely be gone.
  for (const [key, action] of Object.entries(properties)) {
    if (action.kind !== 'delete') continue;
    const rows = await neo4j
      .query<{
        total: number;
      }>(`MATCH (n) WHERE n.\`${key}\` IS NOT NULL RETURN count(n) AS total`)
      .run();
    const count = Number(rows[0]?.total ?? 0);
    if (count > 0) {
      violations.push({
        field: `${key} (field)`,
        probe: 'should have been deleted',
        count,
      });
    }
  }

  const watchlist: Violation[] = [];
  for (const key of ['context', 'problems']) {
    const count = await countLongTextRuns(neo4j, key);
    if (count > 0) {
      watchlist.push({
        field: `${key} (field)`,
        probe: `left unscrubbed by decision — values longer than ${FREE_TEXT_RUN} chars`,
        count,
      });
    }
  }

  return { violations, watchlist, clean: violations.length === 0 };
};
