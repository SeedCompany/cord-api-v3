import { describe, expect, it } from '@jest/globals';
import {
  buildProjectRegistry,
  composeProjectName,
  splitOrdinal,
} from './project-name';
import { PROJECT_TITLES } from './theme';

/**
 * Project names carry two properties the generic strategy destroyed, and both
 * are measured by the migration rather than merely nice to have:
 *
 *  - **Families.** "Mudi", "Mudi 2", "Mudi 3" must stay adjacent, because
 *    `display_order` collation adjacency and `pg_trgm` search ranking are
 *    compared between Neo4j and Postgres on this data.
 *  - **Uniqueness.** `projects.name` is UNIQUE and a collision aborts the load,
 *    which is what the old hex tag guaranteed and readable names give up.
 */
describe('project names', () => {
  describe('splitting the ordinal off', () => {
    it('recognizes every separator shape, because we could not measure which is used', () => {
      // The real separator was unmeasurable when this was written — the only
      // production copy had already been scrubbed. So the parser handles all of
      // them and reports what it matched.
      expect(splitOrdinal('Mudi 2')).toMatchObject({
        base: 'Mudi',
        ordinal: ' 2',
        shape: 'space-digits',
      });
      expect(splitOrdinal('Mudi-2')).toMatchObject({
        base: 'Mudi',
        shape: 'hyphen-digits',
      });
      expect(splitOrdinal('Mudi II')).toMatchObject({
        base: 'Mudi',
        shape: 'space-roman',
      });
      expect(splitOrdinal('Mudi (2)')).toMatchObject({
        base: 'Mudi',
        shape: 'parenthesized',
      });
      expect(splitOrdinal('Mudi')).toMatchObject({
        base: 'Mudi',
        ordinal: '',
        shape: 'none',
      });
    });

    it('keeps a multi-word base intact', () => {
      expect(splitOrdinal('South Sudan Cluster 4')).toMatchObject({
        base: 'South Sudan Cluster',
        ordinal: ' 4',
      });
    });

    it('does not split a name that is nothing but an ordinal', () => {
      // Splitting here would leave an empty base, which is not a family and
      // would map every such name onto one title.
      expect(splitOrdinal('2')).toMatchObject({ base: '2', shape: 'none' });
      expect(splitOrdinal('  7')).toMatchObject({ shape: 'none' });
    });

    it('carries a trailing number through even when it is not an ordinal', () => {
      // "Mudi 2030" is probably a year, and nothing here can tell. Carrying it
      // through is the safe failure: a bare integer carries nothing protected,
      // so the worst case is a number surviving as part of a name.
      expect(splitOrdinal('Mudi 2030').ordinal).toBe(' 2030');
    });
  });

  describe('the registry', () => {
    const bases = Array.from({ length: 4000 }, (_, i) => `base ${i}`);

    it('gives every distinct base a DISTINCT title', () => {
      // The property that replaces the hex tag. `projects.name` is UNIQUE, so a
      // collision here aborts a load.
      const registry = buildProjectRegistry(bases, PROJECT_TITLES);
      expect(registry.size).toBe(bases.length);
      expect(new Set(registry.values()).size).toBe(bases.length);
    });

    it('is stable across runs and independent of read order', () => {
      // Rows come back in whatever order the database chooses; the assignment
      // must not depend on it, or a refresh reshuffles every project name.
      const forwards = buildProjectRegistry(bases, PROJECT_TITLES);
      const backwards = buildProjectRegistry(
        [...bases].reverse(),
        PROJECT_TITLES,
      );
      for (const base of bases) {
        expect(backwards.get(base)).toBe(forwards.get(base));
      }
    });

    it('perturbs almost nothing when one base is added', () => {
      // Collisions walk forward from each base's own hash, so a new project
      // displaces at most its collision partners rather than reshuffling
      // everyone — which is what keeps last month's screenshots meaningful.
      const before = buildProjectRegistry(bases, PROJECT_TITLES);
      const after = buildProjectRegistry(
        [...bases, 'a brand new project'],
        PROJECT_TITLES,
      );
      const moved = bases.filter(
        (base) => after.get(base) !== before.get(base),
      );
      expect(moved.length).toBeLessThan(5);
    });

    it('THROWS rather than suffixing when the pool cannot cover the bases', () => {
      // A silent numeric suffix is exactly the unreadable output this work
      // removes, so exhaustion has to be loud. 5,284 projects is the ceiling on
      // distinct bases and the pool clears it, but a future dataset might not.
      expect(() =>
        buildProjectRegistry(bases, ['Only', 'Three', 'Titles']),
      ).toThrow(/pool too small/i);
    });

    it('is comfortably larger than the project count it has to cover', () => {
      // 5,284 projects, so that is the hard ceiling on distinct bases.
      expect(PROJECT_TITLES.length).toBeGreaterThan(5284);
    });
  });

  describe('composing the replacement', () => {
    const registry = buildProjectRegistry(['Mudi', 'Other'], PROJECT_TITLES);

    it('keeps a family together and keeps its numbering', () => {
      // The whole point: siblings share a base, so they share a title and stay
      // adjacent, with their ordinals intact.
      const first = composeProjectName(registry, 'Mudi');
      const second = composeProjectName(registry, 'Mudi 2');
      const third = composeProjectName(registry, 'Mudi 3');

      expect(second).toBe(`${first} 2`);
      expect(third).toBe(`${first} 3`);
      expect(second.startsWith(first)).toBe(true);
      expect(first).not.toContain('Mudi');
    });

    it('gives different families different titles', () => {
      expect(composeProjectName(registry, 'Mudi')).not.toBe(
        composeProjectName(registry, 'Other'),
      );
    });

    it('preserves a genuine duplicate', () => {
      // Two projects really sharing a name is a finding the migration measures,
      // and the opposite of the decision taken for people's names.
      expect(composeProjectName(registry, 'Mudi 2')).toBe(
        composeProjectName(registry, 'Mudi 2'),
      );
    });

    it('THROWS on a base the registry never saw', () => {
      // The registry is built from a full read of the same field, so a miss
      // means the two passes disagreed — refuse rather than leave a real name.
      expect(() => composeProjectName(registry, 'Never Seen')).toThrow(
        /No title assigned/,
      );
    });
  });
});
