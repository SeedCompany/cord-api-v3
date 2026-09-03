import { describe, expect, it } from '@jest/globals';
import { asc, desc, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  budgetRecords,
  educations,
  engagements,
  fileNodes,
  languages,
  locations,
  organizations,
  partners,
  posts,
  products,
  projects,
  unavailabilities,
  users,
} from '~/core/drizzle/schema';
import { displayOrder } from './order-by';

/**
 * `displayOrder()` decides, from a column alone, whether to attach the
 * case/accent-insensitive `display_order` collation. Both ways of getting that
 * decision wrong are silent:
 *
 * - Collating something it should not means a list quietly reorders. That is how
 *   the user list's default sort — its `id`, an opaque generated identifier —
 *   ended up case-folded, ordering differently from Neo4j and losing the primary
 *   key index for every page.
 * - Skipping something it should collate means one list orders differently from
 *   every other list in the app.
 *
 * Neither shows up as a failure anywhere else: no list spec asserts the default
 * user ordering, and a wrong decision still produces valid SQL and a full page of
 * results. So pin the decision itself.
 */
describe('displayOrder', () => {
  const dialect = new PgDialect();
  const toSql = (col: Parameters<typeof displayOrder>[0]) =>
    dialect.sqlToQuery(sql`${displayOrder(col)}`).sql;

  const isCollated = (col: Parameters<typeof displayOrder>[0]) =>
    toSql(col).includes('collate "display_order"');

  it('collates name columns', () => {
    expect(isCollated(organizations.name)).toBe(true);
    expect(isCollated(organizations.acronym)).toBe(true);
    expect(isCollated(users.realLastName)).toBe(true);
    expect(isCollated(languages.displayName)).toBe(true);
    expect(isCollated(educations.institution)).toBe(true);
    // The default sort of every file and directory listing, so leaving it out
    // reorders those lists without anyone asking for a sort at all.
    expect(isCollated(fileNodes.name)).toBe(true);
  });

  /**
   * The nine that used to be collated because they are text, and are not.
   *
   * Neo4j's own string ordering is raw code points; the folding comes from
   * `@NameField`, and every field below is a plain `@Field()`. Collating them
   * ordered these lists differently from Neo4j — visibly so for the two address
   * fields, the descriptions and the post body, where values differ in case and
   * punctuation. `sort` is a free string on the list inputs, so a client can ask
   * for any of them on either engine.
   */
  it('does NOT collate plain text that Neo4j leaves alone', () => {
    for (const col of [
      organizations.address,
      partners.address,
      partners.pmcEntityCode,
      locations.isoAlpha3,
      posts.body,
      products.describeCompletion,
      products.placeholderDescription,
      projects.departmentId,
      unavailabilities.description,
    ]) {
      expect(isCollated(col)).toBe(false);
    }
  });

  it('does NOT collate a primary key, which holds an opaque id', () => {
    // Every id in this schema is a `text` column, so a plain type check would
    // treat this as prose. `users.id` is the user list's default sort key.
    expect(isCollated(users.id)).toBe(false);
    expect(toSql(users.id)).not.toContain('collate');
  });

  it('does NOT collate a column limited to a fixed set of values', () => {
    // Codes, not prose — and Postgres cannot collate an enum type at all.
    expect(isCollated(engagements.status)).toBe(false);
  });

  it('leaves non-text columns untouched', () => {
    expect(isCollated(engagements.createdAt)).toBe(false);
    expect(isCollated(budgetRecords.fiscalYear)).toBe(false);
  });

  it('emits the collation inside ORDER BY in both directions', () => {
    // Guards the composition, not just the flag: the collation has to sit on the
    // expression so `asc`/`desc` still applies to the collated value.
    for (const dir of [asc, desc]) {
      const rendered = dialect.sqlToQuery(
        dir(displayOrder(organizations.name)),
      ).sql;
      expect(rendered).toContain('collate "display_order"');
    }
  });
});
