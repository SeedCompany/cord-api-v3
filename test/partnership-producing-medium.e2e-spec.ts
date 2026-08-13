import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguageEngagement,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  errors,
  type fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

/**
 * Which partnership is responsible for producing each medium on a language
 * engagement.
 *
 * Runs on BOTH engines deliberately. Every case here is about behaviour the two
 * have to share, and the Postgres arm alone would prove nothing about parity.
 *
 * The shape worth knowing before reading these: a medium may be mentioned only
 * ONCE per request, and that rule lives in the service — above the engine split —
 * so it holds identically on Neo4j and Postgres. It also protects the Postgres
 * repository, which writes the whole request as a single upsert: Postgres refuses
 * to let one statement touch the same row twice ("ON CONFLICT DO UPDATE command
 * cannot affect row a second time"), so a repeated medium reaching that far would
 * fail the request outright. The service check is why it never does, and the
 * duplicate case below is what keeps that true.
 */
describe('Partnership producing medium e2e', () => {
  let app: TestApp;
  let project: fragments.project;
  let engagement: { id: ID };

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [
        Role.Administrator,
        Role.FieldOperationsDirector,
        Role.Controller,
        Role.ProjectManager,
      ],
    });

    project = await createProject(app);
    engagement = await runAsAdmin(
      app,
      async () => await createLanguageEngagement(app, { project: project.id }),
    );
  });

  const ProducingMediumsDoc = graphql(`
    query engagementProducingMediums($id: ID!) {
      engagement(id: $id) {
        ... on LanguageEngagement {
          partnershipsProducingMediums {
            canRead
            items {
              medium
              partnership {
                id
              }
            }
          }
        }
      }
    }
  `);

  const UpdateDoc = graphql(`
    mutation updateProducingMediums(
      $engagement: ID!
      $input: [UpdatePartnershipProducingMedium!]!
    ) {
      updatePartnershipsProducingMediums(
        engagement: $engagement
        input: $input
      ) {
        engagement {
          id
        }
      }
    }
  `);

  /** The partnership assigned to a medium, or null when nothing is. */
  const assignedTo = async (medium: string) => {
    const result = await app.graphql.query(ProducingMediumsDoc, {
      id: engagement.id,
    });
    // `engagement` is a union; the field exists only on the language arm. Narrow
    // rather than assert, so a fixture that somehow made the wrong kind fails
    // here with a clear reason instead of a confusing null further down.
    const eng = result.engagement;
    if (!('partnershipsProducingMediums' in eng)) {
      throw new Error('Expected a LanguageEngagement');
    }
    const list = eng.partnershipsProducingMediums;
    expect(list.canRead).toBe(true);
    const pair = list.items.find((item) => item.medium === medium);
    return pair?.partnership?.id ?? null;
  };

  it('assigns a partnership to a medium, then clears it', async () => {
    const partnership = await createPartnership(app, { project: project.id });

    await app.graphql.mutate(UpdateDoc, {
      engagement: engagement.id,
      input: [{ medium: 'Print', partnership: partnership.id }],
    });
    expect(await assignedTo('Print')).toBe(partnership.id);

    // A null partnership clears the assignment rather than erroring.
    await app.graphql.mutate(UpdateDoc, {
      engagement: engagement.id,
      input: [{ medium: 'Print', partnership: null }],
    });
    expect(await assignedTo('Print')).toBeNull();
  });

  it('sets two different mediums in one request', async () => {
    const [first, second] = await Promise.all([
      createPartnership(app, { project: project.id }),
      createPartnership(app, { project: project.id }),
    ]);

    // Two rows in one statement is the normal case and must keep working — the
    // duplicate rule below is about the same medium twice, not about batching.
    await app.graphql.mutate(UpdateDoc, {
      engagement: engagement.id,
      input: [
        { medium: 'Web', partnership: first.id },
        { medium: 'Audio', partnership: second.id },
      ],
    });

    expect(await assignedTo('Web')).toBe(first.id);
    expect(await assignedTo('Audio')).toBe(second.id);
  });

  it('refuses a medium mentioned twice, on either engine', async () => {
    const [first, second] = await Promise.all([
      createPartnership(app, { project: project.id }),
      createPartnership(app, { project: project.id }),
    ]);

    // Rejected by the service, so both engines answer the same way and neither
    // repository ever receives the duplicate. Asserted as a clean input error
    // rather than any failure: on Postgres an unguarded duplicate would surface
    // as a server error from the upsert instead, which is the outcome this pins
    // against.
    await expect(
      app.graphql.mutate(UpdateDoc, {
        engagement: engagement.id,
        input: [
          { medium: 'Video', partnership: first.id },
          { medium: 'Video', partnership: second.id },
        ],
      }),
    ).rejects.toThrowGqlError(
      errors.input({ message: 'A medium can only be mentioned once' }),
    );

    // And the refusal left nothing behind — a partial write would be worse than
    // the error, since the caller has been told the request did not happen.
    expect(await assignedTo('Video')).toBeNull();
  });
});
