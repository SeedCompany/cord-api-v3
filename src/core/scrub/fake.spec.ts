import { describe, expect, it } from '@jest/globals';
import { RichTextDocument } from '~/common';
import { fakeValue } from './fake';

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
      const once = fakeValue('personName', 'Some Person');
      const twice = fakeValue('personName', 'Some Person');
      expect(once).toBe(twice);
      expect(once).not.toBe('Some Person');
    });

    it('is stable across every strategy', () => {
      const strategies = [
        'personName',
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
      const isolated = fakeValue('personName', 'A');
      fakeValue('entityName', 'unrelated');
      fakeValue('prose', 'unrelated and longer text here');
      expect(fakeValue('personName', 'A')).toBe(isolated);
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
