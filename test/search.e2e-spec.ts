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
  createProject,
  createSession,
  createTestApp,
  registerUser,
  type TestApp,
  updateProject,
} from './utility';

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

describe('Search e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // Administrator so every matched field is readable — search gates results
    // on the requester's read-perm for the matched field.
    await registerUser(app, { roles: [Role.Administrator] });
  });

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

  it('finds a resource by its exact id', async () => {
    const org = await createOrganization(app);

    const { search } = await app.graphql.query(SearchDoc, {
      input: { query: org.id, count: 25 },
    });

    const ids = search.items.map((i) => ('id' in i ? i.id : null));
    expect(ids).toContain(org.id);
  });

  // Partner is a public searchable type with no human-text column, so it's not
  // text-searched — but exact-id lookup must still work (parity with Neo4j's
  // global base-node-by-id arm). Regression guard for the id-only branches.
  it('finds an omitted-text searchable type by exact id (Partner)', async () => {
    const partner = await createPartner(app);

    const { search } = await app.graphql.query(SearchDoc, {
      input: { query: partner.id, count: 25 },
    });

    const ids = search.items.map((i) => ('id' in i ? i.id : null));
    expect(ids).toContain(partner.id);
  });

  // Product subtypes are searchable by exact id through the per-subtype id-only
  // branch (products table, discriminator-filtered). Guards the subtype label
  // mapping in the PG repo's union — a polymorphic member, not a flat table.
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

    const { search } = await app.graphql.query(SearchDoc, {
      input: { query: product.id, count: 25 },
    });

    const ids = search.items.map((i) => ('id' in i ? i.id : null));
    expect(ids).toContain(product.id);
  });

  // Periodic reports live in their own branch with NO deleted_at column, so the
  // PG repo special-cases them (softDelete=false). Exact-id lookup must still
  // resolve them — this is the branch most likely to regress under that
  // special-casing.
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

    const { search } = await app.graphql.query(SearchDoc, {
      input: { query: reportId, count: 25 },
    });

    const ids = search.items.map((i) => ('id' in i ? i.id : null));
    expect(ids).toContain(reportId);
  });

  it('returns nothing for a query that matches no resource', async () => {
    const { search } = await app.graphql.query(SearchDoc, {
      input: { query: faker.string.alpha(20), count: 25 },
    });
    expect(search.items).toHaveLength(0);
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
