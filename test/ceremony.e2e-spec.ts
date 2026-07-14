import { beforeAll, describe, expect, it } from '@jest/globals';
import { Role } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import {
  createLanguageEngagement,
  createSession,
  createTestApp,
  registerUser,
  type TestApp,
} from './utility';

describe('Ceremony e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // ProjectManager to create the project/engagement, FieldOperationsDirector
    // to update the ceremony.
    await registerUser(app, {
      roles: [Role.ProjectManager, Role.FieldOperationsDirector],
    });
  });

  // A ceremony has no direct create mutation — one is created automatically
  // when an engagement is created. So we spin up an engagement to get one.
  async function createCeremony() {
    const engagement = await createLanguageEngagement(app);
    const { engagement: read } = await app.graphql.query(
      graphql(`
        query engagementCeremony($id: ID!) {
          engagement(id: $id) {
            id
            ceremony {
              value {
                id
              }
            }
          }
        }
      `),
      { id: engagement.id },
    );
    const ceremony = read.ceremony.value;
    expect(ceremony).toBeDefined();
    return { ceremony: ceremony!, engagementId: engagement.id };
  }

  // `updateCeremony` returns a `CeremonyUpdated` mutation event — the same
  // payload the `ceremonyUpdated` subscription emits. These lock in that shape.
  describe('updateCeremony mutation event', () => {
    it('reports the changed input fields in updatedKeys', async () => {
      const { ceremony } = await createCeremony();

      const { updatedKeys } = await updateCeremonyReturning(app, {
        id: ceremony.id,
        planned: true,
        estimatedDate: '2020-05-13',
      });

      expect(updatedKeys).toContain('planned');
      expect(updatedKeys).toContain('estimatedDate');
      // Untouched fields are not reported.
      expect(updatedKeys).not.toContain('actualDate');
    });

    it('carries new values in `updated` and prior values in `previous`', async () => {
      const { ceremony } = await createCeremony();
      const date = '2020-05-13';

      const {
        updated,
        previous,
        ceremony: result,
      } = await updateCeremonyReturning(app, {
        id: ceremony.id,
        planned: true,
        estimatedDate: date,
      });

      // The new values are reflected in `updated` and on the resolved ceremony.
      expect(updated.planned).toBe(true);
      expect(updated.estimatedDate).toBe(date);
      expect(result.planned.value).toBe(true);
      expect(result.estimatedDate.value).toBe(date);

      // `previous` only carries the keys that changed, at their prior values —
      // a freshly created ceremony had no estimated date.
      expect(previous.estimatedDate).toBeNull();
    });

    it('resolves the acting actor in `by`', async () => {
      const { ceremony } = await createCeremony();

      const { by } = await updateCeremonyReturning(app, {
        id: ceremony.id,
        planned: true,
      });

      expect(by.canRead).toBe(true);
      expect(by.value?.id).toBeDefined();
    });

    // This linkage is what lets consumers (e.g. the Salesforce syncer) resolve
    // the owning engagement from a `ceremonyUpdated` event, which otherwise only
    // identifies the ceremony.
    it('resolves the owning engagement on the ceremony', async () => {
      const { ceremony, engagementId } = await createCeremony();

      const { ceremony: result } = await updateCeremonyReturning(app, {
        id: ceremony.id,
        planned: true,
      });

      expect(result.engagement.id).toBe(engagementId);
    });

    it('reports no changes when nothing actually changes', async () => {
      const { ceremony } = await createCeremony();

      // Set planned:true once...
      await updateCeremonyReturning(app, { id: ceremony.id, planned: true });
      // ...then again with the same value — nothing changed.
      const { updatedKeys } = await updateCeremonyReturning(app, {
        id: ceremony.id,
        planned: true,
      });

      expect(updatedKeys).toHaveLength(0);
    });
  });
});

async function updateCeremonyReturning(
  app: TestApp,
  input: InputOf<typeof UpdateCeremonyReturningDoc>,
) {
  const result = await app.graphql.mutate(UpdateCeremonyReturningDoc, {
    input,
  });
  return result.updateCeremony;
}
const UpdateCeremonyReturningDoc = graphql(`
  mutation updateCeremonyReturning($input: UpdateCeremony!) {
    updateCeremony(input: $input) {
      updatedKeys
      updated {
        planned
        estimatedDate
        actualDate
      }
      previous {
        planned
        estimatedDate
        actualDate
      }
      ceremony {
        id
        planned {
          value
        }
        estimatedDate {
          value
        }
        engagement {
          id
        }
      }
      by {
        canRead
        value {
          id
        }
      }
    }
  }
`);
