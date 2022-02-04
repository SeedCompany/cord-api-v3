import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import { Powers, Role } from '../src/components/authorization';
import { PartnershipAgreementStatus } from '../src/components/partnership';
import { ProjectStep } from '../src/components/project';
import {
  approveProjectChangeRequest,
  createFundingAccount,
  createLocation,
  createPartner,
  createPartnership,
  createProject,
  createProjectChangeRequest,
  createRegion,
  createSession,
  createTestApp,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
  updateProject,
} from './utility';
import { fragments } from './utility/fragments';
import { resetDatabase } from './utility/reset-database';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

const readPartnerships = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query project($id: ID!, $changeset: ID) {
        project(id: $id, changeset: $changeset) {
          ...project
          partnerships {
            items {
              id
            }
          }
        }
      }
      ${fragments.project}
    `,
    {
      id,
      changeset,
    }
  );

const readPartnership = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query partnership($id: ID!, $changeset: ID) {
        partnership(id: $id, changeset: $changeset) {
          ...partnership
        }
      }
      ${fragments.partnership}
    `,
    {
      id,
      changeset,
    }
  );

const activeProject = async (app: TestApp) => {
  const fundingAccount = await createFundingAccount(app);
  const location = await createLocation(app, {
    fundingAccountId: fundingAccount.id,
  });
  const fieldRegion = await createRegion(app);
  const project = await createProject(app);
  await updateProject(app, {
    id: project.id,
    primaryLocationId: location.id,
    fieldRegionId: fieldRegion.id,
  });
  await runAsAdmin(app, async () => {
    for (const next of [
      ...stepsFromEarlyConversationToBeforeActive,
      ProjectStep.Active,
    ]) {
      await changeProjectStep(app, project.id, next);
    }
  });

  return project;
};

describe.skip('Partnership Changeset Aware e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(
      app,
      [Powers.CreateLanguage, Powers.CreateEthnologueLanguage],
      {
        roles: [Role.ProjectManager, Role.Administrator],
      }
    );
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('Create', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    await createPartnership(app, {
      projectId: project.id,
    });
    // Create new partnership with changeset
    const changesetPartnership = await app.graphql.mutate(
      gql`
        mutation createPartnership($input: CreatePartnershipInput!) {
          createPartnership(input: $input) {
            partnership {
              ...partnership
            }
          }
        }
        ${fragments.partnership}
      `,
      {
        input: {
          partnership: {
            partnerId: (await createPartner(app)).id,
            projectId: project.id,
          },
          changeset: changeset.id,
        },
      }
    );
    // list partnerships without changeset
    let result = await readPartnerships(app, project.id);
    expect(result.project.partnerships.items.length).toBe(1);
    // list partnerships with changeset
    result = await readPartnerships(app, project.id, changeset.id);
    expect(result.project.partnerships.items.length).toBe(2);
    expect(result.project.partnerships.items[1].id).toBe(
      changesetPartnership.createPartnership.partnership.id
    );
    await approveProjectChangeRequest(app, changeset.id);
    result = await readPartnerships(app, project.id);
    expect(result.project.partnerships.items.length).toBe(2);
  });

  it('Update', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });
    const partnership = await createPartnership(app, {
      projectId: project.id,
      mouStatus: PartnershipAgreementStatus.AwaitingSignature,
    });
    // Update partnership prop with changeset
    await app.graphql.mutate(
      gql`
        mutation updatePartnership($input: UpdatePartnershipInput!) {
          updatePartnership(input: $input) {
            partnership {
              ...partnership
            }
          }
        }
        ${fragments.partnership}
      `,
      {
        input: {
          partnership: {
            id: partnership.id,
            mouStatus: PartnershipAgreementStatus.Signed,
          },
          changeset: changeset.id,
        },
      }
    );

    // read partnership without changeset
    let result = await readPartnership(app, partnership.id);
    expect(
      result.partnership.mouStatus.value !== PartnershipAgreementStatus.Signed
    );
    // read partnership with changeset
    result = await readPartnership(app, partnership.id, changeset.id);
    expect(result.partnership.mouStatus.value).toBe(
      PartnershipAgreementStatus.Signed
    );
    await approveProjectChangeRequest(app, changeset.id);
    result = await readPartnership(app, partnership.id);
    expect(result.partnership.mouStatus.value).toBe(
      PartnershipAgreementStatus.Signed
    );
  });

  it('Delete', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    await createPartnership(app, {
      projectId: project.id,
    });

    const partnership = await createPartnership(app, {
      projectId: project.id,
    });

    // Delete partnereship in changeset
    let result = await app.graphql.mutate(
      gql`
        mutation deletePartnership($id: ID!, $changeset: ID) {
          deletePartnership(id: $id, changeset: $changeset) {
            __typename
          }
        }
      `,
      {
        id: partnership.id,
        changeset: changeset.id,
      }
    );
    const actual: boolean | undefined = result.deletePartnership;
    expect(actual).toBeTruthy();

    // List partnerships without changeset
    result = await readPartnerships(app, project.id);
    expect(result.project.partnerships.items.length).toBe(2);
    // List partnerships with changeset
    result = await readPartnerships(app, project.id, changeset.id);
    expect(result.project.partnerships.items.length).toBe(1);
    await approveProjectChangeRequest(app, changeset.id);
    // List partnerships without changeset
    result = await readPartnerships(app, project.id);
    expect(result.project.partnerships.items.length).toBe(1);
  });
});
