import { CalendarDate, ID, Sensitivity } from '../../src/common';
import { Role, ScopedRole } from '../../src/components/authorization';
import { Budget } from '../../src/components/budget';
import { Location } from '../../src/components/location';
import { PartnerType } from '../../src/components/partner';
import { Project, ProjectType } from '../../src/components/project';
import {
  addLocationToOrganization,
  createBudget,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  gql,
  listBudgets,
  Raw,
  readBudgetRecords,
  readOneBudget,
  readOneProjectBudget,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { testRole } from '../utility/roles';
import {
  expectSensitiveProperty,
  expectSensitiveRelationList,
} from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Budget Security e2e', () => {
  let app: TestApp;
  let testProject: Raw<Project>;
  let testBudget: Budget;
  let location: Location;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(
      app,
      { roles: [Role.LeadFinancialAnalyst, Role.FieldOperationsDirector] }
      // [
      // Powers.CreateLanguage,
      // Powers.CreateEthnologueLanguage,
      // ]
    );
    testProject = await createProject(app);
    testBudget = (await readOneProjectBudget(app, testProject.id)).budget
      .value!;
    const org = await createOrganization(app);
    const partner = await createPartner(app, {
      organizationId: org.id,
    });
    await createPartnership(app, {
      partnerId: partner.id,
      projectId: testProject.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      financialReportingType: undefined,
      mouStartOverride: CalendarDate.fromISO('2000-01-01'),
      mouEndOverride: CalendarDate.fromISO('2004-01-01'),
    });
    location = await runAsAdmin(app, async () => {
      return await createLocation(app);
    });
    await addLocationToOrganization({ app, orgId: org.id, locId: location.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Restricted by role', () => {
    describe.each`
      role
      ${Role.Administrator}
      ${Role.Consultant}
      ${Role.ConsultantManager}
      ${Role.Controller}
      ${Role.FieldOperationsDirector}
      ${Role.FinancialAnalyst}
      ${Role.Fundraising}
      ${Role.Intern}
      ${Role.LeadFinancialAnalyst}
      ${Role.Leadership}
      ${Role.Liaison}
      ${Role.Marketing}
      ${Role.Mentor}
      ${Role.ProjectManager}
      ${Role.RegionalCommunicationsCoordinator}
    `('Global $role', ({ role }) => {
      test.each`
        property                   | readFunction     | staticResource
        ${'universalTemplateFile'} | ${readOneBudget} | ${Budget}
      `(
        ' reading $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: { ...testBudget, sensitivity: testProject.sensitivity },
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            skipEditCheck: false,
          });
        }
      );
    });
  });

  describe('Listing is secure', () => {
    describe.each`
      role                                      | globalCanList | projectCanList | sensitivityAccess
      ${Role.Administrator}                     | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Consultant}                        | ${false}      | ${true}        | ${Sensitivity.High}
      ${Role.ConsultantManager}                 | ${true}       | ${true}        | ${Sensitivity.Medium}
      ${Role.Controller}                        | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.FieldOperationsDirector}           | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.FinancialAnalyst}                  | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Fundraising}                       | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Intern}                            | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.LeadFinancialAnalyst}              | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Leadership}                        | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Liaison}                           | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Marketing}                         | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Mentor}                            | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.ProjectManager}                    | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.RegionalCommunicationsCoordinator} | ${false}      | ${false}       | ${Sensitivity.High}
      ${Role.RegionalDirector}                  | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.StaffMember}                       | ${true}       | ${true}        | ${Sensitivity.High}
      ${Role.Translator}                        | ${true}       | ${true}        | ${Sensitivity.High}
    `('$role', ({ role, globalCanList, projectCanList, sensitivityAccess }) => {
      it('Global canList ', async () => {
        const user = await runInIsolatedSession(app, async () => {
          return await registerUser(app, {
            roles: [role],
          });
        });
        const proj = await createProject(app);

        const read = await user.runAs(async () => {
          return await listBudgets(app);
        });

        if (!globalCanList) {
          expect(read).toHaveLength(0);
        } else {
          switch (sensitivityAccess) {
            case Sensitivity.High: {
              expect(read).not.toHaveLength(0);
              break;
            }
            case Sensitivity.Medium: {
              expect(read).toHaveLength(0);
              break;
            }
            case Sensitivity.Low: {
              expect(read).toHaveLength(0);
            }
          }
        }

        // Test if can list when the project is a medium sensitivity project
        const medlang = await runAsAdmin(app, async () => {
          return await createLanguage(app, {
            sensitivity: Sensitivity.Medium,
          });
        });
        const medLangEng = await createLanguageEngagement(app, {
          languageId: medlang.id,
          projectId: proj.id,
        });

        const readMed = await user.runAs(async () => {
          return await listBudgets(app);
        });

        if (!globalCanList) {
          expect(readMed).toHaveLength(0);
        } else {
          switch (sensitivityAccess) {
            case Sensitivity.High: {
              expect(readMed).not.toHaveLength(0);
              break;
            }
            case Sensitivity.Medium: {
              expect(readMed).not.toHaveLength(0);
              break;
            }
            case Sensitivity.Low: {
              expect(readMed).toHaveLength(0);
            }
          }
        }

        // Test if can list when the project is a medium sensitivity project
        const lang = await runAsAdmin(app, async () => {
          return await createLanguage(app, {
            sensitivity: Sensitivity.Low,
          });
        });
        const lowLangEng = await createLanguageEngagement(app, {
          languageId: lang.id,
          projectId: proj.id,
        });

        const readLow = await user.runAs(async () => {
          return await listBudgets(app);
        });

        if (!globalCanList) {
          expect(readLow).toHaveLength(0);
        } else {
          switch (sensitivityAccess) {
            case Sensitivity.High: {
              expect(readLow).not.toHaveLength(0);
              break;
            }
            case Sensitivity.Medium: {
              expect(readLow).not.toHaveLength(0);
              break;
            }
            case Sensitivity.Low: {
              expect(readLow).not.toHaveLength(0);
            }
          }
        }
        //reset after each test so that we only have budgets associated with highly sensitive projects
        await runAsAdmin(app, async () => {
          await deleteEngagement(app, medLangEng.id);
          await deleteEngagement(app, lowLangEng.id);
        });
      });

      it('Project canList', async () => {
        const user = await runInIsolatedSession(app, async () => {
          return await registerUser(app, {
            roles: [role],
          });
        });
        await createProjectMember(app, {
          projectId: testProject.id,
          roles: [role],
          userId: user.id,
        });
        const read = await user.runAs(async () => {
          return await listBudgets(app);
        });

        if (!projectCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });

  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                      | sensitivityToTest     | projectType
      ${Role.ConsultantManager} | ${Sensitivity.Medium} | ${ProjectType.Translation}
      ${Role.ConsultantManager} | ${Sensitivity.Medium} | ${ProjectType.Internship}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest on $projectType Project',
      ({ role, sensitivityToTest, projectType }) => {
        it(' reading universalTemplateFile', async () => {
          const proj = await createProject(app, { type: projectType });
          const budget = await createBudget(app, { projectId: proj.id });
          await expectSensitiveProperty({
            app,
            role: role,
            propertyToCheck: 'universalTemplateFile',
            projectId: proj.id,
            resourceId: budget.id,
            resource: Budget,
            sensitivityRestriction: sensitivityToTest,
            permissions: await getPermissions({
              app,
              resource: Budget,
              userRole: `global:${role as Role}` as ScopedRole,
            }),
            readOneFunction: readOneBudget,
            projectType: projectType,
          });
        });

        it(' reading records', async () => {
          const proj = await createProject(app, { type: projectType });
          const budget = await readOneProjectBudget(app, proj.id);
          const org = await createOrganization(app);
          const partner = await createPartner(app, {
            organizationId: org.id,
            types: [PartnerType.Funding, PartnerType.Managing],
          });
          await createPartnership(app, {
            partnerId: partner.id,
            projectId: proj.id,
            types: [PartnerType.Funding, PartnerType.Managing],
            financialReportingType: undefined,
            mouStartOverride: CalendarDate.fromISO('2000-01-01'),
            mouEndOverride: CalendarDate.fromISO('2004-01-01'),
          });
          await addLocationToOrganization({
            app,
            orgId: org.id,
            locId: location.id,
          });
          if (budget.budget.value) {
            await expectSensitiveRelationList({
              app,
              role,
              sensitivityRestriction: sensitivityToTest,
              projectId: proj.id,
              projectType: projectType,
              resource: Budget,
              propertyToCheck: 'records',
              readFunction: readBudgetRecords,
              resourceId: budget.budget.value.id,
              perms: await getPermissions({
                app,
                resource: Budget,
                userRole: `global:${role as Role}` as ScopedRole,
              }),
            });
          }
        });
      }
    );
  });
});
async function deleteEngagement(app: TestApp, id: ID) {
  await app.graphql.mutate(
    gql`
      mutation deleteEngagement($id: ID!) {
        deleteEngagement(id: $id) {
          __typename
        }
      }
    `,
    {
      id: id,
    }
  );
}
