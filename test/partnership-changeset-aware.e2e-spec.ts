import { gql } from 'apollo-server-core';
import { Role } from '../src/components/authorization';
import { PartnershipAgreementStatus } from '../src/components/partnership';
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
  registerUser,
  runAsAdmin,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';
import { transitionNewProjectToActive } from './utility/transition-project';

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
  const [location, fieldRegion] = await runAsAdmin(app, async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const fieldRegion = await createRegion(app);

    return [location, fieldRegion];
  });

  const project = await createProject(app, {
    primaryLocationId: location.id,
    fieldRegionId: fieldRegion.id,
  });
  await runAsAdmin(app, async () => {
    await transitionNewProjectToActive(app, project);
  });

  return project;
};

describe('Partnership Changeset Aware e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.ProjectManager, Role.Administrator],
    });
  });

  afterAll(async () => {
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
    let result = await runAsAdmin(app, async () => {
      return await app.graphql.mutate(
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
    });
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
