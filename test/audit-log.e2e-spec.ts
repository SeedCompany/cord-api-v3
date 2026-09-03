import { beforeAll, describe, expect, it } from '@jest/globals';
import { setOf } from '@seedcompany/common';
import { sql } from 'drizzle-orm';
import { CalendarDate, generateId, type ID, Role } from '~/common';
import { type Session } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle';
import { graphql } from '~/graphql';
import { AuditService } from '../src/components/audit/audit.service';
import { ResourceMutatedHook } from '../src/components/audit/resource-mutated.hook';
import { ResourceMutationRepository } from '../src/components/audit/resource-mutation.repository';
import { SessionHost } from '../src/core/authentication/session/session.host';
import { SessionManager } from '../src/core/authentication/session/session.manager';
import {
  createDirectProduct,
  createLanguage,
  createLanguageEngagement,
  createOrganization,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  errors,
  type fragments,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  type TestApp,
  type TestUser,
} from './utility';

// The audit log lives in postgres; under neo4j the writer is a no-op, so the
// history is expected to be empty there.
const isPostgres = process.env.DATABASE === 'postgres';

// Cases that read `resource_mutations` itself have nothing to check under neo4j —
// the table has no counterpart there. Declaring them with these instead of
// returning early inside the body makes jest report them as SKIPPED. A test that
// returns before it asserts anything still counts as a pass, which reads as
// coverage that does not exist.
//
// The `expect(history.total).toBe(0)` branches further down are deliberately NOT
// converted: those assert real neo4j behaviour (the writer stays inert and the
// history query still resolves), so they earn their pass on both engines.
const itPostgresOnly = isPostgres ? it : it.skip;
const describePostgresOnly = isPostgres ? describe : describe.skip;

describe('Audit log (resource_mutations) e2e', () => {
  let app: TestApp;
  let project: fragments.project;
  // Engagement window shared by the polymorphic-history cases below; the end is
  // derived from the start so the two dates can't drift apart.
  const engStart = CalendarDate.local(1991, 1, 1);
  const engEnd = engStart.plus({ years: 1 });

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.Controller],
    });
    project = await createProject(app);
  });

  it('rejects a non-admin from viewing resource history', async () => {
    // The acting session here is FieldOperationsDirector + Controller (see
    // beforeAll) — neither is an admin, so this pins the new gate itself,
    // not just the admin-wrapped happy paths every other case below uses.
    await expect(
      app.graphql.query(ProjectHistoryDoc, { id: project.id }),
    ).rejects.toThrowGqlError(
      errors.unauthorized({
        message: 'Only administrators can view resource history',
      }),
    );
  });

  it('records create + update mutations in a resource history', async () => {
    const partnership = await createPartnership(app, { project: project.id });

    await app.graphql.mutate(UpdatePartnershipDoc, {
      input: { id: partnership.id, agreementStatus: 'Signed' },
    });

    // Resource history is admin-only (an interim gate — see the resolver);
    // read it under an isolated admin session rather than the acting user's.
    const { partnership: read } = await runAsAdmin(app, () =>
      app.graphql.query(HistoryDoc, { id: partnership.id }),
    );
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

    const { organization: read } = await runAsAdmin(app, () =>
      app.graphql.query(OrgHistoryDoc, { id: org.id }),
    );
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

    const { project: read } = await runAsAdmin(app, () =>
      app.graphql.query(ProjectHistoryDoc, { id: proj.id }),
    );
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
      startDateOverride: engStart.toISO(),
      endDateOverride: engEnd.toISO(),
    });

    const { engagement: read } = await runAsAdmin(app, () =>
      app.graphql.query(EngagementHistoryDoc, { id: engagement.id }),
    );

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
      startDateOverride: engStart.toISO(),
      endDateOverride: engEnd.toISO(),
    });
    const product = await createDirectProduct(app, {
      engagement: engagement.id,
    });

    const { product: read } = await runAsAdmin(app, () =>
      app.graphql.query(ProductHistoryDoc, { id: product.id }),
    );

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
  // blow up. Regression guard for the registration-time crash — and, since 0027,
  // the agent that acted is named rather than merely omitted.
  it('audits an anonymous-actor mutation with a null actor (no FK violation)', async () => {
    const newUser = await runInIsolatedSession(app, () =>
      registerUser(app, { roles: [] }),
    );

    const { user: read } = await runAsAdmin(app, () =>
      app.graphql.query(UserHistoryDoc, { id: newUser.id }),
    );

    if (!isPostgres) {
      expect(read.history.total).toBe(0);
      return;
    }
    // registration should record a Create
    const create = read.history.items.find((i) => i.action === 'Create');
    expect(create).toBeTruthy();
    expect(create!.actor).toBeNull();
    expect(create!.actorSystemAgent).toBe('Anonymous');
    expect(create!.impersonator).toBeNull();
  });

  // Audit writes happen inside the triggering mutation's transaction, so if the
  // mutation later fails the audit row must roll back with it — no orphaned
  // "this happened" record for something that didn't.
  itPostgresOnly(
    'rolls back the audit row when the surrounding transaction fails',
    async () => {
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
        actorSystemAgent: null,
        impersonatorId: null,
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
    },
  );

  // `Identity.currentMaybe` hands back the EFFECTIVE session, so all three of
  // these used to go wrong in the same place: an impersonated mutation was
  // recorded as the impersonatee (silently), and a ghost-impersonated one blew
  // up the actor FK and rolled the mutation back with it.
  //
  // Driven at the service layer rather than over HTTP because impersonation is
  // header-based and the e2e client exposes no per-request headers; sessions are
  // still built by the real SessionManager path (including its 'ghost' literal
  // swap and the CanImpersonateHook gate) rather than hand-assembled.
  // Every case here reads the actor columns on `resource_mutations`, so the whole
  // block is postgres-only. `describe.skip` also stops the beforeAll below from
  // running, which is why that hook no longer needs its own engine check.
  describePostgresOnly('actor attribution', () => {
    let audit: AuditService;
    let sessions: SessionManager;
    let host: SessionHost;
    let db: DrizzleService;
    let adminToken: string;
    let adminId: ID<'User'>;
    let impersonatee: TestUser;

    beforeAll(async () => {
      audit = app.get(AuditService);
      sessions = app.get(SessionManager);
      host = app.get(SessionHost);
      db = app.get(DrizzleService);

      impersonatee = await runInIsolatedSession(app, () =>
        registerUser(app, { roles: [Role.ProjectManager] }),
      );
      // Impersonation is gated on the requester being able to assign every role
      // they hold (can-impersonate-via-privileges), which today only an
      // Administrator satisfies — so the root session is the only usable one.
      adminToken = await runAsAdmin(app, () => app.graphql.authToken);
      adminId = (await sessions.resumeSession(adminToken)).userId as ID<'User'>;
    });

    /** Record one Update against a throwaway resource id, under `session`. */
    const recordAs = async (session: Session) => {
      const resourceId = await generateId();
      await host.withSession(session, async () => {
        await audit.record(
          new ResourceMutatedHook('Project', resourceId, 'Update', { a: 1 }),
        );
      });
      // Aliased to camelCase so the row type doesn't need snake_case keys.
      const res = await db.client.execute<{
        actorId: string | null;
        actorSystemAgent: string | null;
        impersonatorId: string | null;
        roleAtTime: string[];
      }>(
        sql`select actor_id           as "actorId",
                   actor_system_agent as "actorSystemAgent",
                   impersonator_id    as "impersonatorId",
                   role_at_time       as "roleAtTime"
            from resource_mutations where resource_id = ${resourceId}`,
      );
      expect(res.rows).toHaveLength(1);
      return res.rows[0]!;
    };

    it('records the actor with no impersonator when acting as themselves', async () => {
      const row = await recordAs(await sessions.resumeSession(adminToken));
      expect(row.actorId).toBe(adminId);
      expect(row.impersonatorId).toBeNull();
      expect(row.actorSystemAgent).toBeNull();
    });

    // The silent-misattribution fix: actor is who it was done AS, impersonator
    // is who actually did it. Before 0027 only the former was stored, so the
    // log affirmatively blamed the impersonatee.
    it('records both the impersonatee and the real requester', async () => {
      const row = await recordAs(
        await sessions.resumeSession(adminToken, {
          id: impersonatee.id,
          roles: setOf([]),
        }),
      );
      expect(row.actorId).toBe(impersonatee.id);
      expect(row.impersonatorId).toBe(adminId);
      expect(row.actorSystemAgent).toBeNull();
      // The effective roles — what the policy engine actually evaluated.
      expect(row.roleAtTime).toEqual(['ProjectManager']);
    });

    // Role-only impersonation legitimately yields impersonator == actor. Pinned
    // so it reads as intended rather than as a bug the next time someone looks.
    it('records impersonator == actor for role-only impersonation', async () => {
      const row = await recordAs(
        await sessions.resumeSession(adminToken, {
          roles: setOf([Role.Consultant]),
        }),
      );
      expect(row.actorId).toBe(adminId);
      expect(row.impersonatorId).toBe(adminId);
      expect(row.roleAtTime).toEqual(['Consultant']);
    });

    // Regression guard for the crash: `session.userId` is the Ghost agent's id,
    // which lives in `system_agents`. Storing it as actor_id violated the FK and
    // — since the audit write shares the mutation's transaction — took the whole
    // mutation down. Now the agent is recorded by name, and the admin behind it
    // is still attributed.
    it('records a ghost-impersonated mutation by agent name (no FK violation)', async () => {
      const row = await recordAs(
        await sessions.resumeSession(adminToken, {
          id: 'ghost' as ID,
          roles: setOf([]),
        }),
      );
      expect(row.actorId).toBeNull();
      expect(row.actorSystemAgent).toBe('Ghost');
      expect(row.impersonatorId).toBe(adminId);
    });

    // The two actor columns are mutually exclusive at the DB level, so a future
    // writer can't half-fill them regardless of what the service does.
    it('rejects a row naming both a user and a system agent as actor', async () => {
      const resourceId = await generateId();
      const failure = await db.client
        .execute(
          sql`insert into resource_mutations
                (resource_type, resource_id, action, actor_id, actor_system_agent)
              values ('Project', ${resourceId}, 'Update', ${adminId}, 'Ghost')`,
        )
        .then(
          () => null,
          (error: unknown) => error,
        );
      // Drizzle wraps the driver error, so assert on the pg error underneath it
      // — its `constraint` names what rejected, which the wrapper's message
      // (just the failed SQL) does not.
      expect(failure).not.toBeNull();
      expect((failure as { cause?: unknown }).cause).toMatchObject({
        constraint: 'resource_mutations_actor_shape_chk',
      });
    });
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
          actorSystemAgent
          impersonator {
            id
          }
        }
      }
    }
  }
`);
