import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createDirectProduct,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createOrganization,
  createPartner,
  createPerson,
  createProject,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  type TestApp,
  updateProject,
} from './utility';

const isPostgres = process.env.DATABASE === 'postgres';

const SearchDoc = graphql(`
  query search($input: SearchInput!) {
    search(input: $input) {
      items {
        __typename
        ... on Organization {
          id
          name {
            value
          }
        }
        ... on Location {
          id
          name {
            value
          }
        }
        ... on Partner {
          id
        }
        ... on Language {
          id
        }
        ... on Project {
          id
        }
        ... on User {
          id
        }
        ... on DirectScriptureProduct {
          id
        }
        ... on NarrativeReport {
          id
        }
      }
    }
  }
`);

// createProject's default MOU window. An engagement has to sit inside its
// project's window — the engagement fixture otherwise defaults both date
// overrides to `now`, which lands ~34 years outside it and leaves the pair in a
// state the app would never produce.
const engStart = CalendarDate.local(1991, 1, 1);
const engEnd = engStart.plus({ years: 1 });

// A random token that cannot collide with other rows in the database, so an
// assertion about "search finds exactly this" is not at the mercy of fixtures
// created by other cases in the file.
const tok = () => faker.string.alpha({ length: 8, casing: 'lower' });

describe('Search e2e', () => {
  let app: TestApp;

  const searchIds = async (query: string) => {
    const { search } = await app.graphql.query(SearchDoc, {
      input: { query, count: 25 },
    });
    return search.items.map((item) => ('id' in item ? item.id : null));
  };
  const found = async (query: string, id: string) =>
    (await searchIds(query)).some((hit) => hit === id);

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // Administrator so every matched field is readable — search only returns a
    // hit if the requester can read the field that matched.
    await registerUser(app, { roles: [Role.Administrator] });
  });

  describe('basics', () => {
    it('finds a resource by a substring of its name', async () => {
      const token = faker.string.alpha(12);
      const org = await createOrganization(app, {
        name: `${faker.company.name()} ${token} Inc`,
      });

      const { search } = await app.graphql.query(SearchDoc, {
        input: { query: token, count: 25 },
      });

      const ids = search.items.map((i) => ('id' in i ? i.id : null));
      expect(ids).toContain(org.id);
      const match = search.items.find((i) => 'id' in i && i.id === org.id);
      expect(match?.__typename).toBe('Organization');
    });

    it('restricts results to the requested type', async () => {
      // Same token on two different resource types.
      const token = faker.string.alpha(12);
      const org = await createOrganization(app, {
        name: `${faker.company.name()} ${token}`,
      });
      const location = await createLocation(app, {
        name: `${faker.lorem.word()} ${token}`,
      });

      const { search } = await app.graphql.query(SearchDoc, {
        input: { query: token, count: 25, type: ['Organization'] },
      });

      const ids = search.items.map((i) => ('id' in i ? i.id : null));
      expect(ids).toContain(org.id);
      expect(ids).not.toContain(location.id);
      expect(search.items.every((i) => i.__typename === 'Organization')).toBe(
        true,
      );
    });

    it('returns nothing for a query that matches no resource', async () => {
      const { search } = await app.graphql.query(SearchDoc, {
        input: { query: faker.string.alpha(20), count: 25 },
      });
      expect(search.items).toHaveLength(0);
    });
  });

  describe('by exact id', () => {
    it('finds a resource by its exact id', async () => {
      const org = await createOrganization(app);
      expect(await found(org.id, org.id)).toBe(true);
    });

    it('finds a partner by its exact id', async () => {
      const partner = await createPartner(app);
      expect(await found(partner.id, partner.id)).toBe(true);
    });

    // Product subtypes resolve through the per-subtype branch, discriminated
    // by a `type` column. Guards the subtype label mapping in the PG repo's
    // union — a polymorphic member, not a flat table.
    it('finds a product subtype by exact id (DirectScriptureProduct)', async () => {
      const project = await createProject(app);
      const language = await createLanguage(app);
      const engagement = await createLanguageEngagement(app, {
        project: project.id,
        language: language.id,
        startDateOverride: engStart.toISO(),
        endDateOverride: engEnd.toISO(),
      });
      const product = await createDirectProduct(app, {
        engagement: engagement.id,
      });

      expect(await found(product.id, product.id)).toBe(true);
    });

    it('finds a periodic report by exact id (NarrativeReport)', async () => {
      const project = await createProject(app);
      // Narrative reports are synced into existence when the MOU window is set.
      await updateProject(app, {
        id: project.id,
        mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
        mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
      });
      const { project: read } = await app.graphql.query(
        ProjectNarrativeReportsDoc,
        { id: project.id },
      );
      const reportId = read.narrativeReports.items[0]!.id;
      expect(reportId).toBeTruthy();

      expect(await found(reportId, reportId)).toBe(true);
    });
  });

  // Neo4j indexed every stored string, so any of these was searchable. The
  // first Postgres port listed only `name` columns, which silently dropped the
  // lot; a user reported it as "No results found" when searching a department
  // ID. Each case below was verified to pass on Neo4j before being added.
  describe('identifier and detail fields', () => {
    it('project departmentId', async () => {
      // Only admins may set a department ID directly (the requester is one);
      // otherwise it is assigned from a block at finance confirmation.
      const departmentId = faker.string.numeric({
        length: 5,
        allowLeadingZeros: false,
      });
      const project = await createProject(app, { departmentId });

      expect(await found(departmentId, project.id)).toBe(true);
      const items = await searchIds(departmentId);
      expect(items).toContain(project.id);
    });

    it('project rev79ProjectId', async () => {
      const t = tok();
      const project = await createProject(app, { rev79ProjectId: `R79${t}` });
      expect(await found(`R79${t}`, project.id)).toBe(true);
    });

    it('project tags (a text[] column)', async () => {
      const t = tok();
      const project = await createProject(app, { tags: [`ptag${t}`] });
      expect(await found(`ptag${t}`, project.id)).toBe(true);
    });

    it('partner pmcEntityCode', async () => {
      const code = faker.string.alpha({ length: 3, casing: 'upper' });
      const partner = await createPartner(app, { pmcEntityCode: code });
      expect(await found(code, partner.id)).toBe(true);
    });

    it('partner address', async () => {
      const t = tok();
      const partner = await createPartner(app, { address: `Addr${t} Street` });
      expect(await found(`Addr${t}`, partner.id)).toBe(true);
    });

    it('organization address surfaces its partner', async () => {
      const t = tok();
      const org = await createOrganization(app, { address: `Orgaddr${t}` });
      const partner = await createPartner(app, { organization: org.id });
      expect(await found(`Orgaddr${t}`, partner.id)).toBe(true);
    });

    it('language registryOfLanguageVarietiesCode', async () => {
      const code = faker.string.numeric({
        length: 5,
        allowLeadingZeros: false,
      });
      const language = await createLanguage(app, {
        registryOfLanguageVarietiesCode: code,
      });
      expect(await found(code, language.id)).toBe(true);
    });

    it('language signLanguageCode', async () => {
      const code =
        faker.string.alpha({ length: 2, casing: 'upper' }) +
        faker.string.numeric(2);
      const language = await createLanguage(app, { signLanguageCode: code });
      expect(await found(code, language.id)).toBe(true);
    });

    it('language displayNamePronunciation', async () => {
      const t = tok();
      const language = await createLanguage(app, {
        displayNamePronunciation: `Pron${t}`,
      });
      expect(await found(`Pron${t}`, language.id)).toBe(true);
    });

    it('language tags (a text[] column)', async () => {
      const t = tok();
      const language = await createLanguage(app, { tags: [`ltag${t}`] });
      expect(await found(`ltag${t}`, language.id)).toBe(true);
    });

    it('location isoAlpha3', async () => {
      const location = await createLocation(app);
      const code = location.isoAlpha3.value!;
      expect(code).toBeTruthy();
      expect(await found(code, location.id)).toBe(true);
    });

    it('user email', async () => {
      const t = tok();
      const user = await createPerson(app, { email: `em${t}@example.com` });
      expect(await found(`em${t}`, user.id)).toBe(true);
    });

    it('user phone', async () => {
      const phone = `5559${faker.string.numeric(6)}`;
      const user = await createPerson(app, { phone });
      expect(await found(phone, user.id)).toBe(true);
    });

    it('user title', async () => {
      const t = tok();
      const user = await createPerson(app, { title: `Title${t}` });
      expect(await found(`Title${t}`, user.id)).toBe(true);
    });

    it('user about', async () => {
      const t = tok();
      const user = await createPerson(app, { about: `About${t}` });
      expect(await found(`About${t}`, user.id)).toBe(true);
    });
  });

  // The query is split into words and each is matched separately. Matching the
  // whole query as one literal substring — which the first Postgres port did —
  // fails every case in here, including the most common search there is.
  describe('word handling', () => {
    it('a full name, whose words live in two different columns', async () => {
      const t = tok();
      const user = await createPerson(app, {
        realFirstName: `Fn${t}`,
        realLastName: `Ln${t}`,
      });
      expect(await found(`Fn${t} Ln${t}`, user.id)).toBe(true);
    });

    it('two words of a name typed out of order', async () => {
      const t = tok();
      const project = await createProject(app, {
        name: `Alpha${t} Beta${t}`,
      });
      expect(await found(`Beta${t} Alpha${t}`, project.id)).toBe(true);
    });

    it('two words spanning a language name and display name', async () => {
      const t = tok();
      const language = await createLanguage(app, {
        name: `Nm${t}`,
        displayName: `Dp${t}`,
      });
      expect(await found(`Nm${t} Dp${t}`, language.id)).toBe(true);
    });

    it('a hyphenated name typed with a space', async () => {
      const t = tok();
      const project = await createProject(app, { name: `Hy${t}-Zz${t}` });
      expect(await found(`Hy${t} Zz${t}`, project.id)).toBe(true);
    });

    it('a name with a comma typed without it', async () => {
      const t = tok();
      const project = await createProject(app, { name: `Cm${t}, Ww${t}` });
      expect(await found(`Cm${t} Ww${t}`, project.id)).toBe(true);
    });

    it('a doubly-spaced name typed with one space', async () => {
      const t = tok();
      const project = await createProject(app, { name: `Sp${t}  Dd${t}` });
      expect(await found(`Sp${t} Dd${t}`, project.id)).toBe(true);
    });

    // Neo4j OR'd the query's words, so a real word plus a typo still found the
    // real match. Preserved deliberately: relevance ranking keeps the good
    // matches at the top rather than letting the junk word hide them.
    it('a real word plus a word that matches nothing', async () => {
      const t = tok();
      const project = await createProject(app, { name: `Real${t}` });
      expect(await found(`Real${t} zzzznomatch`, project.id)).toBe(true);
    });
  });

  describe('accent folding', () => {
    it('an unaccented query finds an accented name', async () => {
      const t = tok();
      const project = await createProject(app, { name: `Zünderlé${t}` });
      expect(await found(`Zunderle${t}`, project.id)).toBe(true);
    });

    it('an accented query finds an unaccented name', async () => {
      const t = tok();
      const project = await createProject(app, { name: `Zunderle${t}` });
      expect(await found(`Zünderlé${t}`, project.id)).toBe(true);
    });
  });

  describe('relevance ranking', () => {
    // Neo4j returned hits ordered by Lucene score, so its 100-row ceiling took
    // the best 100. Postgres has no such score, so the repo computes one; if it
    // regressed to an arbitrary order the ceiling would start dropping good
    // matches. Mirrors Lucene's phrase boost: the whole query matched
    // contiguously must outrank the same words matched separately.
    //
    // Both rows must contain BOTH words, or the per-word part of the score
    // separates them by itself and the phrase bonus is never what decides.
    // The contiguous row is also created FIRST, so the newest-first tie-break
    // works against the assertion instead of quietly satisfying it. Getting
    // either of those wrong makes these pass with no bonus in the query at all.
    const twoRows = async (token: string) => {
      const contiguous = await createProject(app, {
        name: `Foo${token} Bar${token}`,
      });
      const apart = await createProject(app, {
        name: `Foo${token} between Bar${token}`,
      });
      return { contiguous, apart };
    };

    it('a contiguous match outranks the same words spread apart', async () => {
      const t = tok();
      const { contiguous, apart } = await twoRows(t);

      const ids = await searchIds(`Foo${t} Bar${t}`);
      expect(ids).toContain(contiguous.id);
      expect(ids).toContain(apart.id);
      expect(ids.indexOf(contiguous.id)).toBeLessThan(ids.indexOf(apart.id));
    });

    // Pasted queries arrive padded, and phones insert a trailing space. The
    // ranking must not care: the phrase test is built from the normalized
    // words, not the raw string, because the row's columns are joined with
    // exactly one space and `%  Foo  Bar  %` would never match.
    it('a padded or doubly-spaced query still ranks the contiguous match first', async () => {
      const t = tok();
      const { contiguous, apart } = await twoRows(t);

      for (const query of [
        ` Foo${t} Bar${t} `,
        `Foo${t}  Bar${t}`,
        `\tFoo${t}\nBar${t}`,
      ]) {
        const ids = await searchIds(query);
        expect(ids).toContain(contiguous.id);
        expect(ids).toContain(apart.id);
        expect(ids.indexOf(contiguous.id)).toBeLessThan(ids.indexOf(apart.id));
      }
    });

    it('an exact id outranks a row that merely mentions it', async () => {
      const target = await createProject(app);
      // A second project carrying the first one's id in its name, so the same
      // query matches one row by id and the other only as text.
      const mentions = await createProject(app, {
        name: `Mentions ${target.id}`,
      });

      const ids = await searchIds(target.id);
      expect(ids).toContain(mentions.id);
      expect(ids[0]).toBe(target.id);
    });
  });

  // Two places where Postgres deliberately does NOT match Neo4j, because
  // Neo4j's behavior was worse. Asserted only on Postgres so the Neo4j engine
  // job does not fail on behavior it never had.
  (isPostgres ? describe : describe.skip)('deliberate improvements', () => {
    it('a fragment from the middle of a word finds it', async () => {
      // Lucene has no leading wildcard, so Neo4j could only match whole words
      // and prefixes. Matching substrings anywhere is a superset: it finds
      // strictly more, never less.
      const t = tok();
      const project = await createProject(app, { name: `Xy${t}Zq` });
      expect(await found(t, project.id)).toBe(true);
    });

    it('returns nothing for a whitespace-only query', async () => {
      // A query with no words must not degenerate into a '%%' pattern that
      // matches every row of every searchable table. Neo4j returned six
      // arbitrary rows here, because its trailing `*` matched everything and
      // the row ceiling truncated the result — junk, not a feature.
      const { search } = await app.graphql.query(SearchDoc, {
        input: { query: '   ', count: 25 },
      });
      expect(search.items).toHaveLength(0);
    });
  });

  describe('read permission on the matched field', () => {
    // Every other case in this file runs as Administrator, who can read
    // everything — so none of them can tell a working permission check from one
    // that returns every hit to everyone. That is how the check stayed dead:
    // it asked `key in perms` against an always-empty lazy view, so it always
    // answered "no permission recorded, show it anyway".
    //
    // `pmcEntityCode` is the field to test with: a Staff Member can read a
    // Partner but that one prop is explicitly denied to them
    // (staff-member.policy.ts), so a hit that matched ONLY on it must not come
    // back. The code is 3 uppercase letters by validation, so it is chosen to
    // avoid appearing anywhere in the organization's name — an organization hit
    // surfaces its partner, which would find the partner through a field the
    // Staff Member IS allowed to read and make the test lie.
    it('hides a hit whose only matched field the requester cannot read', async () => {
      const orgName = `Permission Check ${tok()} Inc`;
      let code: string;
      do {
        code = faker.string.alpha({ length: 3, casing: 'upper' });
      } while (orgName.toLowerCase().includes(code.toLowerCase()));

      const partner = await runAsAdmin(app, async () => {
        const org = await createOrganization(app, { name: orgName });
        return await createPartner(app, {
          organization: org.id,
          pmcEntityCode: code,
        });
      });

      // The fixture works and the field is searchable: the admin finds it.
      expect(await found(code, partner.id)).toBe(true);

      const staff = await registerUser(app, { roles: [Role.StaffMember] });
      await staff.runAs(async () => {
        // Positive control — search itself works for this persona, so a `false`
        // below means the permission check fired, not that the user sees
        // nothing at all.
        expect(await searchIds(orgName)).not.toHaveLength(0);

        expect(await found(code, partner.id)).toBe(false);
      });
    });
  });
});

const ProjectNarrativeReportsDoc = graphql(`
  query ProjectNarrativeReports($id: ID!) {
    project(id: $id) {
      narrativeReports {
        items {
          id
        }
      }
    }
  }
`);
