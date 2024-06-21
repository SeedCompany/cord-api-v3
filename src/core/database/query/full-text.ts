import { entries, isNotNil, many, Many, mapKeys } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import { LiteralUnion } from 'type-fest';
import { procedure } from '../query-augmentation/call';
import { CypherExpression, exp, isExp } from './cypher-expression';
import { db } from './cypher-functions';

export type FullTextIndex = ReturnType<typeof FullTextIndex>;

/**
 * @see https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/full-text-indexes/
 */
export const FullTextIndex = (config: {
  indexName: string;
  labels: Many<string>;
  properties: Many<string>;
  analyzer?: Analyzer;
  /**
   * This means that updates will be applied in a background thread "as soon as possible",
   * instead of during a transaction commit, which is true for other indexes.
   */
  eventuallyConsistent?: boolean;
}) => {
  const quote = (q: string) => `'${q}'`;

  const { indexName } = config;

  return {
    /**
     * Query to create the full text index (if needed).
     */
    create: () => {
      const parsedConfig = {
        analyzer: config.analyzer ? quote(config.analyzer) : undefined,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        eventually_consistent: config.eventuallyConsistent
          ? exp(config.eventuallyConsistent)
          : undefined,
      };
      const options =
        entries(pickBy(parsedConfig, (v) => v !== undefined)).length > 0
          ? {
              indexConfig: mapKeys(parsedConfig, (k) => `fulltext.${k}`)
                .asRecord,
            }
          : undefined;
      const query = `
        CREATE FULLTEXT INDEX ${indexName} IF NOT EXISTS
        FOR (n:${many(config.labels).join('|')})
        ON EACH ${exp(many(config.properties).map((p) => `n.${p}`))}
        ${options ? `OPTIONS ${exp(options)}` : ''}
      `;
      return (q: Query) => q.raw(query);
    },

    /**
     * Query the full text index for results.
     *
     * NOTE: the `query` is Lucene syntax.
     * If this is coming from user input, consider using the {@link escapeLuceneSyntax} function.
     */
    search: (
      query: string,
      options: {
        skip?: number;
        limit?: number;
        analyzer?: Analyzer;
      } = {},
    ) => {
      // fallback to "" when no query is given, so that no results are
      // returned instead of the procedure failing
      query = query.trim() || '""';

      return db.index.fulltext.queryNodes(indexName, query, options);
    },
  };
};

export const escapeLuceneSyntax = (query: string) =>
  query
    .replace(/[![\]~)(+\-:?*"^&|{}\\/]/g, (char) => `\\${char}`)
    .replace(/\b(OR|AND|NOT)\b/g, (char) => `"${char}"`);

export const IndexFullTextQueryNodes = (
  indexName: string,
  query: string,
  options?:
    | {
        skip?: number;
        limit?: number;
        analyzer?: string;
      }
    | CypherExpression,
) =>
  procedure('db.index.fulltext.queryNodes', ['node', 'score'])({
    indexName,
    query,
    ...(options &&
    (Object.values(options).filter(isNotNil).length > 0 || isExp(options))
      ? { options }
      : undefined),
  });

type Analyzer = LiteralUnion<KnownAnalyzer, string>;

/**
 * List from Neo4j with:
 * CALL db.index.fulltext.listAvailableAnalyzers()
 */
type KnownAnalyzer =
  // Analyzer that uses ASCIIFoldingFilter to remove accents (diacritics).
  // Otherwise, it behaves as a standard english analyzer.
  // Note: This analyzer may have unexpected behavior, such as tokenizing, for all non-ASCII numbers and symbols.
  | 'standard-folding'
  // A simple analyzer that tokenizes at non-letter boundaries.
  // No stemming or filtering.
  // Works okay for most European languages, but is terrible for languages where words aren't separated by spaces, such as many Asian languages.
  | 'simple'
  // Stop analyzer tokenizes at non-letter characters, and filters out English stop words.
  // This differs from the 'classic' and 'standard' analyzers in that it makes no effort to recognize special terms,
  // like likely product names, URLs or email addresses.
  | 'stop'
  // Keyword analyzer "tokenizes" the text as a single term.
  // Useful for zip-codes, ids, etc. Situations where complete and exact matches are desired.
  | 'keyword'
  // The standard analyzer.
  // Tokenizes on non-letter and filters out English stop words and punctuation.
  // Does no stemming, but takes care to keep likely product names, URLs and email addresses as single terms.
  | 'standard'
  // Breaks text into terms by characters that have the unicode WHITESPACE property.
  | 'unicode_whitespace'
  // Tokenizes into sequences of alphanumeric, numeric, URL, email, southeast asian terms,
  // and into terms of individual ideographic and hiragana characters.
  // English stop words are filtered out.
  | 'url'
  // English analyzer with stemming and stop word filtering.
  | 'english'
  // Tokenizes into sequences of alphanumeric, numeric, URL, email, southeast asian terms,
  // and into terms of individual ideographic and hiragana characters.
  // English stop words are filtered out.
  | 'url_or_email'
  // The default analyzer.
  // Similar to the 'standard' analyzer, but filters no stop words.
  // Tokenizes on non-letter boundaries filters out punctuation.
  // Does no stemming, but takes care to keep likely product names, URLs and email addresses as single terms.
  | 'standard-no-stop-words'
  // Classic Lucene analyzer. Similar to 'standard', but with worse unicode support.
  | 'classic'
  // Tokenizes into sequences of alphanumeric, numeric, URL, email, southeast asian terms,
  // and into terms of individual ideographic and hiragana characters.
  // English stop words are filtered out.
  | 'email'
  // Breaks text into terms by characters that are considered "Java whitespace".
  | 'whitespace';
