import { describe, expect, it } from '@jest/globals';
import { RichTextDocument } from '~/common';
import { fakeValue } from './fake';
import { GIVEN_NAMES, SURNAMES } from './theme';

/**
 * The properties the scrub depends on, tested rather than assumed.
 *
 * Determinism and distinctness are not cosmetic here: determinism is what keeps a
 * monthly refresh usable and what preserves the duplicate-name finding the
 * migration test measures, and distinctness is what stops a unique constraint
 * aborting a load. Both are easy to break with a small edit to `fake.ts`, and
 * neither would be obvious from reading the output.
 */
describe('scrub fake values', () => {
  describe('determinism', () => {
    it('gives the same replacement for the same input, every time', () => {
      const once = fakeValue('givenName', 'Robert');
      const twice = fakeValue('givenName', 'Robert');
      expect(once).toBe(twice);
      expect(once).not.toBe('Robert');
    });

    it('is stable across every strategy', () => {
      const strategies = [
        'givenName',
        'surname',
        'entityName',
        'languageName',
        'email',
        'phone',
        'address',
        'prose',
      ] as const;
      for (const strategy of strategies) {
        expect(fakeValue(strategy, 'input value')).toBe(
          fakeValue(strategy, 'input value'),
        );
      }
    });

    it('does not let one call bleed into the next', () => {
      // faker is seeded globally, so an interleaved call could shift the sequence
      // and make results depend on call ORDER rather than input.
      const isolated = fakeValue('entityName', 'A');
      fakeValue('givenName', 'unrelated');
      fakeValue('prose', 'unrelated and longer text here');
      expect(fakeValue('entityName', 'A')).toBe(isolated);
    });
  });

  describe('person names', () => {
    // These four fields are the reason the theme work started. One strategy used
    // to serve all of them and it generated a FULL name every time, so
    // `realLastName` held "Orlando Considine Jr." and the initials derived from
    // these fields were wrong.
    const inputs = Array.from({ length: 500 }, (_, i) => `person ${i}`);

    it('puts exactly one name in a single-name field', () => {
      for (const input of inputs) {
        expect(fakeValue('givenName', input)).not.toMatch(/\s/);
        expect(fakeValue('surname', input)).not.toMatch(/\s/);
      }
    });

    it('draws only from the reviewed pools', () => {
      // The pools are the review artifact, so nothing may reach the database
      // that a reviewer has not seen. This is also what the verify pass's
      // closed-set probe depends on being true.
      for (const input of inputs) {
        expect(GIVEN_NAMES).toContain(fakeValue('givenName', input));
        expect(SURNAMES).toContain(fakeValue('surname', input));
      }
    });

    it('keeps given names and surnames in separate pools', () => {
      // A surname field must not receive a given name. The two pools are
      // disjoint, so a value alone says which field it belongs to — which is
      // what makes the verify probes able to tell them apart.
      const overlap = GIVEN_NAMES.filter((name) => SURNAMES.includes(name));
      expect(overlap).toEqual([]);
    });

    it('spreads across the pool instead of favoring a few names', () => {
      // A modulo over a weak digest could bunch up, which would quietly shrink
      // the pool to a handful of names and undo the coverage below. Covering an
      // 863-name pool needs ~5,800 uniform draws (n·ln n), so 6,000 sat right on
      // the edge — 15,000 keeps this a fixed outcome rather than a threshold
      // that trips the next time the pool grows.
      const used = new Set(
        Array.from({ length: 15000 }, (_, i) =>
          fakeValue('givenName', `person number ${i}`),
        ),
      );
      expect(used.size).toBe(GIVEN_NAMES.length);
    });

    it('leaves a blank name blank instead of inventing one', () => {
      // Blanks in these four fields are why the columns were made nullable, and
      // how many there are is an open question in the migration. Filling one in
      // would erase that evidence — so a blank is correct output, and the verify
      // pass's closed-set probe has to allow it for the same reason.
      expect(fakeValue('givenName', '')).toBe('');
      expect(fakeValue('surname', '')).toBe('');
    });

    it('gives the same fake to a real and display name that match', () => {
      // Real first name and display first name are separate records holding the
      // same string for most people. Keeping them equal after the scrub is what
      // makes the copy behave like the original, where a differing display name
      // is the exception rather than the rule. Still true with per-record
      // keying, because both fields hang off the SAME user.
      expect(fakeValue('givenName', 'Robert', 'user-1')).toBe(
        fakeValue('givenName', 'Robert', 'user-1'),
      );
    });

    describe('unique per person', () => {
      // DECIDED (Rob, 2026-09-01): a person's full name should be unique across
      // the dataset. Pool size alone cannot deliver that — keyed on the value,
      // everyone sharing a real first name necessarily gets the same fake one.
      it('gives two people with the SAME real name different fakes', () => {
        expect(fakeValue('givenName', 'John', 'user-1')).not.toBe(
          fakeValue('givenName', 'John', 'user-2'),
        );
        expect(fakeValue('surname', 'Smith', 'user-1')).not.toBe(
          fakeValue('surname', 'Smith', 'user-2'),
        );
      });

      it('keeps one person stable across refreshes', () => {
        // The id is the salt, and an id is more stable than a name — so a person
        // keeps their fake even if their real name changes spelling.
        expect(fakeValue('surname', 'Smith', 'user-1')).toBe(
          fakeValue('surname', 'Smith', 'user-1'),
        );
      });

      it('still gives one person different fakes for different historical values', () => {
        // A name field keeps every previous version. Those must not collapse
        // onto one fake, or the copy loses the fact that the name changed.
        expect(fakeValue('surname', 'Smith', 'user-1')).not.toBe(
          fakeValue('surname', 'Jones', 'user-1'),
        );
      });

      it('makes full names essentially unique across a realistic population', () => {
        // 2,375 people who all share one real name — the worst case for the old
        // value-only keying, which would map every one of them onto a single
        // full name.
        const fullNames = new Set(
          Array.from({ length: 2375 }, (_, i) => {
            const owner = `user-${i}`;
            const given = fakeValue('givenName', 'John', owner)!;
            const surname = fakeValue('surname', 'Smith', owner)!;
            return `${given} ${surname}`;
          }),
        );
        // Not exactly 2,375: hashing into 863 x 2,664 combinations still
        // collides a couple of times by chance, and only a registry that checks
        // and walks forward would make it exact. Asserting the property that
        // matters — essentially unique — rather than a number that would make
        // this test brittle against any pool edit.
        expect(fullNames.size).toBeGreaterThan(2375 * 0.997);
      });

      it('does NOT key entity names per record, so production collisions survive', () => {
        // The counterpart, and the reason this is a per-strategy decision:
        // project names carry a UNIQUE constraint and production really does
        // have duplicates. Those must keep colliding in the copy.
        expect(fakeValue('entityName', 'Shared Project', 'owner-1')).toBe(
          fakeValue('entityName', 'Shared Project', 'owner-2'),
        );
      });
    });
  });

  describe('the pools are test coverage, not decoration', () => {
    // Better fake data is the whole point of the theme: 0 of 2,376 users moved
    // under the `fullName` concatenation fix on the old scrubbed data, because
    // no faker first name is ever a prefix of another. Real names do this
    // constantly (Ann/Anna, Jon/Jonathan), and so must these.
    it('contains given names that are prefixes of other given names', () => {
      // 20 at the time of writing. Asserting a floor rather than the exact
      // number so adding cast members is not a test edit — but a floor well
      // above the eight deliberate pairs, because a pool edit that collapses
      // the emergent ones is worth hearing about.
      const families = GIVEN_NAMES.filter((name) =>
        GIVEN_NAMES.some((other) => other !== name && other.startsWith(name)),
      );
      expect(families.length).toBeGreaterThanOrEqual(15);
    });

    it('contains surnames that are prefixes of other surnames', () => {
      const families = SURNAMES.filter((name) =>
        SURNAMES.some((other) => other !== name && other.startsWith(name)),
      );
      expect(families.length).toBeGreaterThanOrEqual(1);
    });

    it('carries diacritics, so collation has something to sort', () => {
      // Sort order and `pg_trgm` search parity between Neo4j and Postgres are
      // measured on this data. All-ASCII fakes cannot exercise either.
      const accented = [...GIVEN_NAMES, ...SURNAMES].filter((name) =>
        [...name].some((char) => char.codePointAt(0)! > 127),
      );
      expect(accented.length).toBeGreaterThanOrEqual(5);
    });

    it('spans a wide range of lengths, because length drives column sizing', () => {
      const lengths = [...GIVEN_NAMES, ...SURNAMES].map((name) => name.length);
      expect(Math.min(...lengths)).toBeLessThanOrEqual(3);
      expect(Math.max(...lengths)).toBeGreaterThanOrEqual(9);
    });

    it('holds no entry that would break a single-name field', () => {
      // Whitespace is the old defect. Quotes would break the Cypher list the
      // verify probe builds from these pools.
      for (const name of [...GIVEN_NAMES, ...SURNAMES]) {
        expect(name).not.toMatch(/\s/);
        expect(name).not.toMatch(/["'\\]/);
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it('loses distinctness when fed its own output, so a re-scrub cannot realize a pool change', () => {
      // The property that makes a re-scrub the WRONG way to apply a pool edit,
      // and it cost a wasted run to learn: every generator is a pure function of
      // the value it replaces, so a second pass reads the first pass's output.
      // Its input is then only as varied as that output was, and hashing into a
      // pool can only shrink from there.
      //
      // Measured on the production copy: growing surnames 150 -> 242 and
      // re-scrubbing took surnames in use from 149 DOWN to 101, and duplicate
      // full names from 140 UP to 240.
      // Scaled to the pool rather than a fixed 1,800 — that number was smaller
      // than the pool once the composed surnames landed, so the first assertion
      // was really measuring "fewer inputs than slots" and failed for a reason
      // that had nothing to do with the property under test.
      const realNames = Array.from(
        { length: SURNAMES.length * 4 },
        (_, i) => `real ${i}`,
      );

      const fromRealData = new Set(
        realNames.map((name) => fakeValue('surname', name)),
      );
      const fromScrubbedData = new Set(
        [...fromRealData].map((fake) => fakeValue('surname', fake!)),
      );

      // Real data fills nearly the whole pool; its own output cannot.
      expect(fromRealData.size).toBeGreaterThan(SURNAMES.length * 0.95);
      expect(fromScrubbedData.size).toBeLessThan(fromRealData.size * 0.75);
    });

    it('has no duplicate entries within a pool', () => {
      // A duplicate silently weights one name twice and misleads a reviewer
      // counting what the copy can show.
      expect(new Set(GIVEN_NAMES).size).toBe(GIVEN_NAMES.length);
      expect(new Set(SURNAMES).size).toBe(SURNAMES.length);
    });
  });

  describe('duplicate preservation', () => {
    it('maps two records sharing a name to the same fake name', () => {
      // Production has projects sharing a name. That duplication is a finding the
      // migration measures, so the scrub must not quietly resolve it.
      expect(fakeValue('entityName', 'Shared Name')).toBe(
        fakeValue('entityName', 'Shared Name'),
      );
    });

    it('keeps distinct inputs distinct, so unique constraints survive', () => {
      const generated = new Set(
        Array.from({ length: 2000 }, (_, i) =>
          fakeValue('entityName', `project number ${i}`),
        ),
      );
      expect(generated.size).toBe(2000);
    });
  });

  describe('replacements are not mistakable for real data', () => {
    it('puts emails on the reserved non-routable domain', () => {
      const email = fakeValue('email', 'someone@real-domain.org');
      expect(email).toMatch(/@example\.invalid$/);
      expect(email).not.toContain('real-domain');
    });

    it('keeps emails unique — the column is uniquely indexed', () => {
      const generated = new Set(
        Array.from({ length: 2000 }, (_, i) =>
          fakeValue('email', `person${i}@example.org`),
        ),
      );
      expect(generated.size).toBe(2000);
    });

    it('puts phone numbers in the reserved fictional block', () => {
      expect(fakeValue('phone', '+1 402 555 8721')).toContain('555 01');
    });

    it('empties credentials rather than inventing plausible ones', () => {
      expect(
        fakeValue('credential', '$argon2id$v=19$m=65536,t=3,p=4$abc'),
      ).toBeNull();
    });
  });

  describe('prose', () => {
    it('stays close to the original length', () => {
      const original = 'a'.repeat(240);
      const scrubbed = fakeValue('prose', original)!;
      expect(scrubbed).not.toContain('aaa');
      expect(scrubbed.length).toBeGreaterThan(original.length * 0.8);
      expect(scrubbed.length).toBeLessThanOrEqual(original.length);
    });

    it('leaves an empty value empty', () => {
      expect(fakeValue('prose', '')).toBe('');
    });
  });

  describe('rich text', () => {
    const stored = RichTextDocument.serialize(
      RichTextDocument.from({
        version: '2.25.0',
        time: 1700000000000,
        blocks: [
          {
            id: 'one',
            type: 'paragraph',
            data: { text: 'Sensitive first line.' },
          },
          {
            id: 'two',
            type: 'paragraph',
            data: { text: 'Sensitive second line.' },
          },
        ],
      }),
    );

    it('keeps the document shape and drops the words', () => {
      const scrubbed = fakeValue('richText', stored)!;
      expect(RichTextDocument.isSerialized(scrubbed)).toBe(true);

      const doc = RichTextDocument.fromSerialized(scrubbed) as unknown as {
        version: string;
        blocks: Array<{ id: string; type: string; data: { text: string } }>;
      };
      expect(doc.version).toBe('2.25.0');
      expect(doc.blocks).toHaveLength(2);
      expect(doc.blocks.map((block) => block.id)).toEqual(['one', 'two']);
      expect(doc.blocks.map((block) => block.type)).toEqual([
        'paragraph',
        'paragraph',
      ]);
      expect(scrubbed).not.toContain('Sensitive');
      expect(doc.blocks[0]!.data.text).not.toBe(doc.blocks[1]!.data.text);
    });

    it('re-serializes with the prefix the database expects', () => {
      // Postgres jsonb cannot hold a NUL byte, so a value that keeps the stored
      // form must keep it exactly — half-converted is a hard insert failure later.
      expect(fakeValue('richText', stored)!.startsWith('\0RichText\0')).toBe(
        true,
      );
    });

    it('handles the OBJECT form, which is what the database read actually yields', () => {
      // The regression that mattered. The Neo4j read transformer converts a stored
      // rich-text string into a RichTextDocument object, so this — not the string
      // above — is the shape production data arrives in. The first version
      // stringified it to the constant '[object RichText]', so every document in
      // the graph collapsed to the same generated text and lost its blocks, and
      // the ETL then dropped 30 of 32 comments as unparseable.
      const asObject = RichTextDocument.fromSerialized(stored);
      const scrubbed = fakeValue('richText', asObject)!;

      expect(RichTextDocument.isSerialized(scrubbed)).toBe(true);
      const doc = RichTextDocument.fromSerialized(scrubbed) as unknown as {
        blocks: Array<{ id: string; data: { text: string } }>;
      };
      expect(doc.blocks).toHaveLength(2);
      expect(doc.blocks.map((block) => block.id)).toEqual(['one', 'two']);
      expect(scrubbed).not.toContain('Sensitive');
      expect(scrubbed).not.toContain('object RichText');
    });

    it('gives two different documents two different results', () => {
      // The symptom that would have caught the bug from the outside: every row
      // collapsing to one value. Distinct inputs must stay distinct even as objects.
      const first = RichTextDocument.fromSerialized(stored);
      const second = RichTextDocument.fromSerialized(
        RichTextDocument.serialize(
          RichTextDocument.from({
            version: '2.25.0',
            time: 1700000000000,
            blocks: [
              {
                id: 'x',
                type: 'paragraph',
                data: { text: 'Totally other text.' },
              },
            ],
          }),
        ),
      );
      expect(fakeValue('richText', first)).not.toBe(
        fakeValue('richText', second),
      );
    });

    it('turns a plain string into a VALID document, not bare text', () => {
      // A rich-text column has to hold rich text. Emitting a plain string is what
      // made the value unloadable, so the fallback repairs the shape.
      const scrubbed = fakeValue('richText', 'just a plain string')!;
      expect(RichTextDocument.isSerialized(scrubbed)).toBe(true);
      expect(scrubbed).not.toContain('just a plain string');
    });

    it('refuses to stringify an object for a non-richText strategy', () => {
      // The guard that stops this class of bug recurring on another field.
      expect(() => fakeValue('prose', { some: 'object' })).toThrow(
        /received an object/,
      );
    });

    it('still replaces a value it cannot parse', () => {
      // A field we cannot read is still a field we must not leave in place.
      const notJson = '\0RichText\0{ this is not valid json';
      const scrubbed = fakeValue('richText', notJson)!;
      expect(scrubbed).not.toContain('not valid json');
    });

    describe('one link name, two value types', () => {
      // `description` is rich text on an engagement and a plain string on a
      // product, a tool and an unavailability. The classification keys on the
      // link name, so a single strategy serves all of them and has to decide from
      // the value. Getting this wrong is not cosmetic: a document written where a
      // string was, or the reverse, breaks every read of that field.
      it('keeps the document shape when the value is rich text', () => {
        const scrubbed = fakeValue(
          'proseOrRichText',
          RichTextDocument.fromSerialized(stored),
        )!;

        expect(RichTextDocument.isSerialized(scrubbed)).toBe(true);
        const doc = RichTextDocument.fromSerialized(scrubbed) as unknown as {
          blocks: Array<{ id: string; data: { text: string } }>;
        };
        expect(doc.blocks.map((block) => block.id)).toEqual(['one', 'two']);
        expect(scrubbed).not.toContain('Sensitive');
      });

      it('returns a plain string when the value is a plain string', () => {
        const scrubbed = fakeValue('proseOrRichText', 'A tool description.')!;

        expect(typeof scrubbed).toBe('string');
        expect(RichTextDocument.isSerialized(scrubbed)).toBe(false);
        expect(scrubbed).not.toContain('tool description');
      });

      it('does not throw on the object form the plain strategy refuses', () => {
        // The failure this strategy exists to fix: `prose` guards against objects
        // on purpose, and pointing it at `description` stopped a full scrub run
        // partway through.
        expect(() =>
          fakeValue('proseOrRichText', RichTextDocument.fromSerialized(stored)),
        ).not.toThrow();
      });
    });
  });
});
