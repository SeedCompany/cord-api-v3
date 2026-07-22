import { beforeAll, describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { generateId, Role } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { graphql } from '~/graphql';
import { ResourceMutationRepository } from '../src/components/audit/resource-mutation.repository';
import {
  createDirectProduct,
  createLanguage,
  createLanguageEngagement,
  createOrganization,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  type fragments,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  type TestApp,
} from './utility';

// The audit log lives in postgres; under neo4j the writer is a no-op, so the
// history is expected to be empty there.
const isPostgres = process.env.DATABASE === 'postgres';

describe('Audit log (resource_mutations) e2e', () => {
  let app: TestApp;
  let project: fragments.project;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.Controller],
    });
    project = await createProject(app);
  });

  it('records create + update mutations in a resource history', async () => {
    const partnership = await createPartnership(app, { project: project.id });

    await app.graphql.mutate(UpdatePartnershipDoc, {
      input: { id: partnership.id, agreementStatus: 'Signed' },
    });

    const { partnership: read } = await app.graphql.query(HistoryDoc, {
      id: partnership.id,
    });
    const history = read.history;

    if (!isPostgres) {
      expect(history.total).toBe(0);
      return;
    }

    expect(history.total).toBeGreaterThanOrEqual(2);
    const actions = history.items.map((i) => i.action);
    expect(actions).toContain('Create');
    expect(actions).toContain('Update');

    const update = history.items.find((i) => i.action === 'Update')!;
    expect(update.actor?.id).toBeTruthy();
    // role_at_time snapshots the actor's roles at the moment of the mutation.
    expect(update.roleAtTime).toEqual(
      expect.arrayContaining(['FieldOperationsDirector', 'Controller']),
    );
    // The diffed field set is captured for updates.
    expect(update.changes).toMatchObject({ agreementStatus: 'Signed' });
  });

  // Proves `history` is exposed on the base Resource interface (not a
  // per-domain resolver) and populated by a back-instrumented domain service.
  it('exposes history on any resource via the Resource interface', async () => {
    const org = await createOrganization(app);
    const newName = `${org.name.value ?? 'Org'} (renamed)`;

    await app.graphql.mutate(UpdateOrganizationDoc, {
      input: { id: org.id, name: newName },
    });

    const { organization: read } = await app.graphql.query(OrgHistoryDoc, {
      id: org.id,
    });
    const history = read.history;

    if (!isPostgres) {
      expect(history.total).toBe(0);
      return;
    }

    expect(history.total).toBeGreaterThanOrEqual(2);
    const actions = history.items.map((i) => i.action);
    expect(actions).toContain('Create');
    expect(actions).toContain('Update');

    const update = history.items.find((i) => i.action === 'Update')!;
    expect(update.changes).toMatchObject({ name: newName });
  });

  // Polymorphic resource: the firing service records under the concrete
  // subtype (resolveProjectType(...).name) and the interface resolver reads
  // `info.parentType.name` — they must agree for history to resolve.
  it('records history for a polymorphic resource (Project)', async () => {
    const proj = await createProject(app);
    const newName = 'Renamed ' + proj.id;

    await app.graphql.mutate(UpdateProjectDoc, {
      input: { id: proj.id, name: newName },
    });

    const { project: read } = await app.graphql.query(ProjectHistoryDoc, {
      id: proj.id,
    });
    const history = read.history;

    if (!isPostgres) {
      expect(history.total).toBe(0);
      return;
    }

    expect(history.total).toBeGreaterThanOrEqual(2);
    const actions = history.items.map((i) => i.action);
    expect(actions).toContain('Create');
    expect(actions).toContain('Update');
  });

  // Engagement is a polymorphic interface whose concrete subtype is resolved by
  // `resolveEngagementType`. The create fires under 'LanguageEngagement' and the
  // interface resolver reads `info.parentType.name` — same round-trip risk as
  // Project, but a different resolve helper.
  it('records history for a polymorphic Engagement (LanguageEngagement)', async () => {
    const language = await runAsAdmin(app, createLanguage);
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
    });

    const { engagement: read } = await app.graphql.query(EngagementHistoryDoc, {
      id: engagement.id,
    });

    if (!isPostgres) {
      expect(read.history.total).toBe(0);
      return;
    }
    expect(read.history.total).toBeGreaterThanOrEqual(1);
    expect(read.history.items.map((i) => i.action)).toContain('Create');
  });

  // Product is polymorphic via `resolveProductType`; the concrete subtype name
  // must round-trip the same way.
  it('records history for a polymorphic Product (DirectScriptureProduct)', async () => {
    const language = await runAsAdmin(app, createLanguage);
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
    });
    const product = await createDirectProduct(app, {
      engagement: engagement.id,
    });

    const { product: read } = await app.graphql.query(ProductHistoryDoc, {
      id: product.id,
    });

    if (!isPostgres) {
      expect(read.history.total).toBe(0);
      return;
    }
    expect(read.history.total).toBeGreaterThanOrEqual(1);
    expect(read.history.items.map((i) => i.action)).toContain('Create');
  });

  // Registration runs under an anonymous session: there is no logged-in user,
  // and the anonymous SystemAgent id lives in `system_agents`, NOT `users`. The
  // audit row's actor must be null rather than that id, or the actor FK would
  // blow up. Regression guard for the registration-time crash.
  it('audits an anonymous-actor mutation with a null actor (no FK violation)', async () => {
    const newUser = await runInIsolatedSession(app, () =>
      registerUser(app, { roles: [] }),
    );

    const { user: read } = await app.graphql.query(UserHistoryDoc, {
      id: newUser.id,
    });

    if (!isPostgres) {
      expect(read.history.total).toBe(0);
      return;
    }
    // registration should record a Create
    const create = read.history.items.find((i) => i.action === 'Create');
    expect(create).toBeTruthy();
    expect(create!.actor).toBeNull();
  });

  // Audit writes happen inside the triggering mutation's transaction, so if the
  // mutation later fails the audit row must roll back with it — no orphaned
  // "this happened" record for something that didn't.
  it('rolls back the audit row when the surrounding transaction fails', async () => {
    if (!isPostgres) return;

    const drizzle = app.get(DrizzleService);
    const repo = app.get(ResourceMutationRepository);
    const committedId = await generateId();
    const rolledBackId = await generateId();
    // The repo's insert uses the ambient (ALS) transaction client, so this
    // exercises the same in-transaction write path the audit hook takes —
    // without needing a session context for the actor lookup.
    const mutation = (resourceId: typeof committedId) => ({
      resourceType: 'Project',
      resourceId,
      action: 'Update' as const,
      actorId: null,
      roleAtTime: [],
      changes: { a: 1 },
    });

    // Positive control: a record written in a committed tx persists.
    await drizzle.inTx(async () => {
      await repo.record(mutation(committedId));
    });

    // The record is written, then the surrounding tx throws -> it must vanish.
    await expect(
      drizzle.inTx(async () => {
        await repo.record(mutation(rolledBackId));
        throw new Error('boom: force rollback');
      }),
    ).rejects.toThrow('boom');

    const db = drizzle.client;
    const countFor = async (id: string) => {
      const res = await db.execute<{ n: number } & Record<string, unknown>>(
        sql`select count(*)::int as n from resource_mutations where resource_id = ${id}`,
      );
      return res.rows[0]!.n;
    };
    expect(await countFor(committedId)).toBe(1);
    expect(await countFor(rolledBackId)).toBe(0);
  });
});

const UpdatePartnershipDoc = graphql(`
  mutation UpdatePartnershipForAudit($input: UpdatePartnership!) {
    updatePartnership(input: $input) {
      partnership {
        id
      }
    }
  }
`);

const HistoryDoc = graphql(`
  query PartnershipHistory($id: ID!) {
    partnership(id: $id) {
      history {
        total
        items {
          action
          at
          actor {
            id
          }
          roleAtTime
          changes
        }
      }
    }
  }
`);

const UpdateOrganizationDoc = graphql(`
  mutation UpdateOrganizationForAudit($input: UpdateOrganization!) {
    updateOrganization(input: $input) {
      organization {
        id
      }
    }
  }
`);

const OrgHistoryDoc = graphql(`
  query OrganizationHistory($id: ID!) {
    organization(id: $id) {
      history {
        total
        items {
          action
          changes
        }
      }
    }
  }
`);

const UpdateProjectDoc = graphql(`
  mutation UpdateProjectForAudit($input: UpdateProject!) {
    updateProject(input: $input) {
      project {
        id
      }
    }
  }
`);

const ProjectHistoryDoc = graphql(`
  query ProjectHistory($id: ID!) {
    project(id: $id) {
      history {
        total
        items {
          action
          changes
        }
      }
    }
  }
`);

const EngagementHistoryDoc = graphql(`
  query EngagementHistoryForAudit($id: ID!) {
    engagement: languageEngagement(id: $id) {
      history {
        total
        items {
          action
        }
      }
    }
  }
`);

const ProductHistoryDoc = graphql(`
  query ProductHistoryForAudit($id: ID!) {
    product(id: $id) {
      history {
        total
        items {
          action
        }
      }
    }
  }
`);

const UserHistoryDoc = graphql(`
  query UserHistoryForAudit($id: ID!) {
    user(id: $id) {
      history {
        total
        items {
          action
          actor {
            id
          }
        }
      }
    }
  }
`);
