import { describe, expect, it } from '@jest/globals';
import { classification, isTruncate } from './classification';
import {
  buildNameRegistry,
  composeHashedName,
  composeThemedName,
  findPoolShortfalls,
  NAME_POOLS,
  splitExtension,
  splitOrdinal,
  usesRegistry,
} from './entity-name';
import { fakeValue } from './fake';
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
      const registry = buildNameRegistry('projectName', bases, PROJECT_TITLES);
      expect(registry.size).toBe(bases.length);
      expect(new Set(registry.values()).size).toBe(bases.length);
    });

    it('is stable across runs and independent of read order', () => {
      // Rows come back in whatever order the database chooses; the assignment
      // must not depend on it, or a refresh reshuffles every project name.
      const forwards = buildNameRegistry('projectName', bases, PROJECT_TITLES);
      const backwards = buildNameRegistry(
        'projectName',
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
      const before = buildNameRegistry('projectName', bases, PROJECT_TITLES);
      const after = buildNameRegistry(
        'projectName',
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
        buildNameRegistry('projectName', bases, ['Only', 'Three', 'Titles']),
      ).toThrow(/too small/i);
    });

    it('is comfortably larger than the project count it has to cover', () => {
      // 5,284 projects, so that is the hard ceiling on distinct bases.
      expect(PROJECT_TITLES.length).toBeGreaterThan(5284);
    });
  });

  describe('composing the replacement', () => {
    const registry = buildNameRegistry(
      'projectName',
      ['Mudi', 'Other'],
      PROJECT_TITLES,
    );

    it('keeps a family together and keeps its numbering', () => {
      // The whole point: siblings share a base, so they share a title and stay
      // adjacent, with their ordinals intact.
      const first = composeThemedName(registry, 'Mudi');
      const second = composeThemedName(registry, 'Mudi 2');
      const third = composeThemedName(registry, 'Mudi 3');

      expect(second).toBe(`${first} 2`);
      expect(third).toBe(`${first} 3`);
      expect(second.startsWith(first)).toBe(true);
      expect(first).not.toContain('Mudi');
    });

    it('gives different families different titles', () => {
      expect(composeThemedName(registry, 'Mudi')).not.toBe(
        composeThemedName(registry, 'Other'),
      );
    });

    it('preserves a genuine duplicate', () => {
      // Two projects really sharing a name is a finding the migration measures,
      // and the opposite of the decision taken for people's names.
      expect(composeThemedName(registry, 'Mudi 2')).toBe(
        composeThemedName(registry, 'Mudi 2'),
      );
    });

    it('THROWS on a base the registry never saw', () => {
      // The registry is built from a full read of the same field, so a miss
      // means the two passes disagreed — refuse rather than leave a real name.
      expect(() => composeThemedName(registry, 'Never Seen')).toThrow(
        /No themed name assigned/,
      );
    });
  });
});

/**
 * The generalization past projects.
 *
 * Six more entity names turned out to carry the same `*_name_active_unique`
 * partial index projects do, so they share the registry. What these tests guard
 * is that sharing it did not change what projects already got, and that no pool
 * can quietly fail to do its job.
 */
describe('themed entity names beyond projects', () => {
  const allStrategies = Object.keys(NAME_POOLS) as Array<
    keyof typeof NAME_POOLS
  >;
  // Only these get a registry. Building one for a hash strategy would pass and
  // prove nothing, since files are never assigned that way.
  const registryStrategies = allStrategies.filter(usesRegistry);

  it('reproduces the project assignments made before it generalized', () => {
    // Refresh stability across the refactor, and the reason `projectName` kept
    // its strategy name and its pool: seeding is `seedFor(strategy, base)`, so
    // the string 'projectName' is load-bearing. Renaming it would silently
    // reshuffle every project in every existing copy.
    const bases = ['Mudi', 'South Sudan Cluster', 'Aru', 'Zande'];
    const registry = buildNameRegistry('projectName', bases);
    // Pinned literals, not a recomputation — a test that recomputes with the
    // same code cannot detect the code changing.
    //
    // Their provenance, because a pin is only as good as where it came from:
    // the refactor was first proven safe by DIFFING the two function bodies,
    // which are byte-identical apart from the added `strategy` parameter and the
    // error wording. These values were then read out of the generalized code, so
    // they freeze the behavior that diff showed to be unchanged.
    expect(registry.get('Mudi')).toBe('Rustboro Plateau');
    expect(registry.get('South Sudan Cluster')).toBe('Leicester Highlands');
    expect(registry.get('Aru')).toBe('Hyrule Wetlands');
    expect(registry.get('Zande')).toBe('Fichina Straits');
  });

  it('every strategy has a pool, and every pool has distinct entries', () => {
    // A duplicate inside a pool silently shrinks it — the registry skips a name
    // already taken — and duplicates are exactly what reading a long list by eye
    // misses. This is the check that caught 'Wallace' in two pools once.
    expect(allStrategies.length).toBeGreaterThan(0);
    for (const strategy of allStrategies) {
      const pool = NAME_POOLS[strategy];
      expect(pool.length).toBeGreaterThan(0);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it('every themed strategy the classification routes to has a pool behind it', () => {
    // The two files are edited separately: a strategy named in
    // `classification.ts` without a pool would fail at run time, on a fresh
    // restore, partway through a scrub.
    const routed = Object.values(classification).flatMap((action) =>
      isTruncate(action)
        ? []
        : Object.values(action.columns).flatMap((column) =>
            column?.kind === 'perType'
              ? Object.values(column.types)
              : column?.kind === 'scrub' && column.as in NAME_POOLS
                ? [column.as as keyof typeof NAME_POOLS]
                : [],
          ),
    );
    // Guard the guard: a classification that routed nothing would pass the
    // loop below without asserting anything.
    expect(routed.length).toBeGreaterThan(0);
    for (const strategy of routed) {
      expect(NAME_POOLS[strategy]).toBeDefined();
      expect(NAME_POOLS[strategy].length).toBeGreaterThan(0);
    }
  });

  it('assigns distinct names within a type and does not care about collisions across types', () => {
    // Within a pool the names must be distinct — that is the UNIQUE constraint.
    // Across pools they may collide, because the constraints are per table, and
    // a Location sharing a name with a Project is realistic rather than a bug.
    const bases = Array.from({ length: 500 }, (_, i) => `base ${i}`);
    for (const strategy of registryStrategies) {
      const registry = buildNameRegistry(strategy, bases);
      expect(new Set(registry.values()).size).toBe(bases.length);
    }
  });

  it('gives each type a DIFFERENT name for the same base', () => {
    // The strategy is part of the seed, so an organization and a location that
    // happen to share a base do not both become "Kakariko Province".
    const assignments = registryStrategies.map(
      (strategy) => buildNameRegistry(strategy, ['Shared']).get('Shared')!,
    );
    expect(new Set(assignments).size).toBe(registryStrategies.length);
  });

  it('reports EVERY too-small pool at once rather than the first', () => {
    // A shortfall is found partway through scrubbing a freshly restored copy,
    // and retrying costs a restore. One report of six problems is five restores
    // cheaper than six reports of one.
    const tooMany = new Set(
      Array.from({ length: 99_999 }, (_, i) => `base ${i}`),
    );
    const shortfalls = findPoolShortfalls(
      new Map([
        ['projectName', tooMany],
        ['locationName', tooMany],
        ['toolName', new Set(['just one'])],
      ]),
    );
    expect(
      shortfalls
        .map((shortfall) => shortfall.strategy)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    ).toEqual(['locationName', 'projectName']);
    expect(shortfalls[0]!.distinctBases).toBe(99_999);
  });

  describe('file and directory names', () => {
    it('keeps the extension and replaces only the stem', () => {
      // `file.service.ts:165` reads the extension back out of the name to decide
      // what a download is called, so losing it renames files on their way out.
      const themed = composeHashedName('fileName', 'FY24 Q1 Report.pdf');
      expect(themed.endsWith('.pdf')).toBe(true);
      expect(themed).not.toContain('FY24');
      expect(themed).not.toContain('Report.pdf'.slice(0, 6));
    });

    it('agrees with node extname on the cases that bite', () => {
      // Delegated rather than reimplemented, so these are inherited. Asserted
      // anyway, because the delegation is the thing that could be undone.
      expect(splitExtension('a.tar.gz')).toEqual({
        stem: 'a.tar',
        extension: '.gz',
      });
      expect(splitExtension('noext')).toEqual({
        stem: 'noext',
        extension: '',
      });
      expect(splitExtension('.hidden')).toEqual({
        stem: '.hidden',
        extension: '',
      });
    });

    it('keeps a hidden file hidden', () => {
      // `extname('.gitkeep')` is '' — node treats a dotfile as having no
      // extension — so the stem is the whole name and an empty-stem guard never
      // fires. The first version of this had exactly that bug and renamed
      // `.gitkeep` to a visible file.
      expect(composeHashedName('fileName', '.gitkeep').startsWith('.')).toBe(
        true,
      );
      expect(composeHashedName('fileName', '.gitkeep')).not.toContain(
        'gitkeep',
      );
      // Both halves at once: hidden AND carrying a real extension.
      const themed = composeHashedName('fileName', '.env.local');
      expect(themed.startsWith('.')).toBe(true);
      expect(themed.endsWith('.local')).toBe(true);
      expect(themed).not.toContain('env');
    });

    it('gives one stem one name across differing extensions', () => {
      // Keyed on the stem, so `Report.pdf` and `Report.docx` stay recognizably
      // the same document in two formats, which is what the originals were.
      const asPdf = composeHashedName('fileName', 'Report.pdf');
      const asDocx = composeHashedName('fileName', 'Report.docx');
      expect(asPdf.replace(/\.pdf$/, '')).toBe(asDocx.replace(/\.docx$/, ''));
    });

    it('preserves duplicate file names, which are realistic and everywhere', () => {
      // Two folders each holding a "Progress Report.pdf" is what the real data
      // looks like. Unlike people's names, this duplication is kept.
      expect(composeHashedName('fileName', 'Progress Report.pdf')).toBe(
        composeHashedName('fileName', 'Progress Report.pdf'),
      );
    });

    it('names a directory differently from a file with the same stem', () => {
      // Separate pools, and the strategy is in the seed, so a folder does not
      // end up called "Kakariko Invoice".
      expect(composeHashedName('directoryName', 'Reports')).not.toBe(
        composeHashedName('fileName', 'Reports'),
      );
    });

    it('uses NO registry for files, and a registry for every constrained name', () => {
      // The split follows the database: a registry exists where a UNIQUE index
      // would abort a load. Files have no such index; the other seven do.
      expect(usesRegistry('fileName')).toBe(false);
      expect(usesRegistry('directoryName')).toBe(false);
      for (const strategy of [
        'projectName',
        'organizationName',
        'locationName',
        'fieldZoneName',
        'fieldRegionName',
        'fundingAccountName',
        'toolName',
      ] as const) {
        expect(usesRegistry(strategy)).toBe(true);
      }
    });

    it('spreads stems across the pool well enough for the folder-local math', () => {
      // The claim the whole design rests on: a name competes only against the
      // ~15 others in its folder. So 15 arbitrary stems must almost always land
      // on 15 distinct names. Measured over many synthetic folders rather than
      // argued.
      let collidingFolders = 0;
      const folders = 3000;
      for (const folder of Array(folders).keys()) {
        const names = new Set(
          Array.from({ length: 15 }, (_, index) =>
            composeHashedName('fileName', `folder ${folder} file ${index}.pdf`),
          ),
        );
        if (names.size < 15) collidingFolders++;
      }
      // Uniform-model prediction is ~0.5%; assert an order of magnitude of slack
      // so this measures the design rather than pinning a hash.
      expect(collidingFolders / folders).toBeLessThan(0.05);
    });
  });

  describe('language names', () => {
    it('does NOT treat a dot as an extension', () => {
      // `extname` finds the last dot anywhere, so a language called "St. Mark"
      // would split to a stem of "St" and an extension of ". Mark" — which is
      // why extension handling is scoped to files alone rather than to all the
      // hash strategies.
      const themed = composeHashedName('languageName', 'St. Mark');
      expect(themed).not.toContain('.');
      expect(themed).not.toContain('Mark');
    });

    it('gives the same fake to `name` and `displayName` when production stored one string', () => {
      // The relationship worth preserving: most languages have no separate
      // public name, so both fields hold the same value. One pool keyed on the
      // value reproduces that, where a registry would have invented a distinct
      // alias for every language.
      const viaNameLink = composeHashedName('languageName', 'Bariba');
      const viaDisplayNameStrategy = fakeValue('languageName', 'Bariba');
      expect(viaNameLink).toBe(viaDisplayNameStrategy);
    });

    it('no longer carries a digest tag', () => {
      // It used to be `adjective-hex6`. The verify pass counts tagged names on
      // themed labels, so a leftover tag would now read as a violation.
      expect(fakeValue('languageName', 'Bariba')).not.toMatch(/ [0-9a-f]{10}$/);
      expect(fakeValue('languageName', 'Bariba')).not.toMatch(/-[0-9a-f]{6}$/);
    });

    it('routes both language tables, and both name columns of a language', () => {
      const languages = classification.languages as {
        columns: Record<string, { kind: string; as?: string }>;
      };
      const ethnologue = classification.ethnologueLanguages as {
        columns: Record<string, { kind: string; as?: string }>;
      };
      expect(languages.columns.name).toMatchObject({
        kind: 'scrub',
        as: 'languageName',
      });
      expect(languages.columns.displayName).toMatchObject({
        kind: 'scrub',
        as: 'languageName',
      });
      expect(ethnologue.columns.name).toMatchObject({
        kind: 'scrub',
        as: 'languageName',
      });
    });

    it('reads as a language name, not a place or a company', () => {
      // A bare root is the commonest real shape, and a qualifier is the next —
      // "Southern Bariba". What it must never be is "Kakariko Trading Company".
      const sample = Array.from(
        { length: 50 },
        (_, index) => fakeValue('languageName', `language ${index}`) as string,
      );
      for (const name of sample) {
        expect(name).not.toMatch(
          /Trading Company|Guild|Foundation|Ministries|Report|Budget/,
        );
        expect(name.split(' ').length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('routing by table and type', () => {
    // Neo4j routed on a record's labels; Postgres routes on the table, and for
    // the two tables where one column serves several record types, on the
    // `type` enum. The spec in `classification.spec.ts` proves every enum
    // value is routed; these pin WHICH strategy each one gets.
    const perTypeOf = (table: 'fileNodes' | 'producibles') => {
      const action = classification[table] as {
        columns: {
          name: { kind: string; by: string; types: Record<string, string> };
        };
      };
      expect(action.columns.name.kind).toBe('perType');
      expect(action.columns.name.by).toBe('type');
      return action.columns.name.types;
    };

    it('gives each producible type its OWN strategy', () => {
      // Uniqueness is per type (`producibles_type_name_active_unique`), so one
      // shared strategy would over-constrain by forbidding a Film and a Story
      // from sharing a name.
      expect(perTypeOf('producibles')).toEqual({
        Film: 'filmName',
        Story: 'storyName',
        EthnoArt: 'ethnoArtName',
      });
    });

    it('lets a Film and a Story share a name, from one pool, without either colliding internally', () => {
      const bases = Array.from({ length: 400 }, (_, index) => `base ${index}`);
      const films = buildNameRegistry('filmName', bases);
      const stories = buildNameRegistry('storyName', bases);
      expect(new Set(films.values()).size).toBe(bases.length);
      expect(new Set(stories.values()).size).toBe(bases.length);
      // Same pool, so the two draw from the same vocabulary...
      expect(NAME_POOLS.filmName).toBe(NAME_POOLS.storyName);
      // ...but seeded by strategy, so one base does not get the same name twice.
      expect(films.get('base 0')).not.toBe(stories.get('base 0'));
    });

    it('routes the file types, which are 98.9% of the names in the system', () => {
      // A version takes its File's strategy so the versions of one document
      // keep sharing its name.
      expect(perTypeOf('fileNodes')).toEqual({
        File: 'fileName',
        FileVersion: 'fileName',
        Directory: 'directoryName',
      });
    });

    it('registers every uniquely indexed name, and hashes the rest', () => {
      // The split follows the database: a registry exists where a partial
      // unique index would abort the scrub's own UPDATE.
      const expectRegistry = (
        table: keyof typeof classification,
        strategy: string,
      ) => {
        const action = classification[table] as {
          columns: { name: { as: string } };
        };
        expect(action.columns.name.as).toBe(strategy);
        expect(usesRegistry(strategy as keyof typeof NAME_POOLS)).toBe(true);
      };
      expectRegistry('projects', 'projectName');
      expectRegistry('organizations', 'organizationName');
      expectRegistry('locations', 'locationName');
      expectRegistry('fieldZones', 'fieldZoneName');
      expectRegistry('fieldRegions', 'fieldRegionName');
      expectRegistry('fundingAccounts', 'fundingAccountName');
      expectRegistry('tools', 'toolName');
      expect(usesRegistry('fileName')).toBe(false);
      expect(usesRegistry('directoryName')).toBe(false);
      expect(usesRegistry('languageName')).toBe(false);
    });
  });
});
