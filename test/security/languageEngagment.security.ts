import { Sensitivity } from '../../src/common';
import { Role, ScopedRole } from '../../src/components/authorization';
import { LanguageEngagement } from '../../src/components/engagement';
import { Language } from '../../src/components/language';
import { Project, ProjectType } from '../../src/components/project';
import {
  createLanguage,
  createLanguageEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listLanguageEngagements,
  Raw,
  readOneLanguageEngagement,
  readOneLanguageEngagementParatextId,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { RawLanguageEngagement } from '../utility/fragments';
import { testRole } from '../utility/roles';
import { expectSensitiveProperty } from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Language Engagment Security e2e', () => {
  let app: TestApp;
  let testProject: Raw<Project>;
  let testLanguage: Language;
  let testLanguageEngagement: RawLanguageEngagement;
  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    testProject = await createProject(app);
    testLanguage = await runAsAdmin(
      app,
      async () => await createLanguage(app, { sensitivity: Sensitivity.High })
    );
    testLanguageEngagement = await createLanguageEngagement(app, {
      projectId: testProject.id,
      languageId: testLanguage.id,
    });
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
        property                      | readFunction                 | staticResource
        ${'ceremony'}                 | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'completeDate'}             | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'disbursementCompleteDate'} | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'endDate'}                  | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'endDateOverride'}          | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'firstScripture'}           | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'initialEndDate'}           | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'language'}                 | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'lastReactivatedAt'}        | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'lastSuspendedAt'}          | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'lukePartnership'}          | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'paratextRegistryId'}       | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'pnp'}                      | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'historicGoal'}             | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'sentPrintingDate'}         | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'startDate'}                | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'startDateOverride'}        | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'statusModifiedAt'}         | ${readOneLanguageEngagement} | ${LanguageEngagement}
        ${'status'}                   | ${readOneLanguageEngagement} | ${LanguageEngagement}
      `(
        ' reading $staticResource.name $property',

        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testLanguageEngagement,
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
  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                      | sensitivityToTest
      ${Role.ConsultantManager} | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property                | resource              | readFunction                           | type
          ${'paratextRegistryId'} | ${LanguageEngagement} | ${readOneLanguageEngagementParatextId} | ${ProjectType.Translation}
        `(
          ' reading $type $resource.name $property',
          async ({ property, resource, readFunction, type }) => {
            const proj = await createProject(app);
            const lang = await runAsAdmin(
              app,
              async () =>
                await createLanguage(app, {
                  sensitivity: Sensitivity.Low, // setting to low because we don't want it to effect the other lang engagements for testing
                })
            );
            const langEngagement = await createLanguageEngagement(app, {
              projectId: proj.id,
              languageId: lang.id,
            });
            await expectSensitiveProperty({
              app,
              role,
              propertyToCheck: property,
              projectId: proj.id,
              resourceId: langEngagement.id,
              resource: resource,
              sensitivityRestriction: sensitivityToTest,
              projectType: type,
              permissions: await getPermissions({
                resource: resource,
                userRole: `global:${role as Role}` as ScopedRole,
                sensitivity: sensitivityToTest,
              }),
              readOneFunction: readFunction,
            });
          }
        );
      }
    );
  });
  describe('Restricted by role', () => {
    describe.each`
      role                                      | globalCanList | projectCanList
      ${Role.Administrator}                     | ${true}       | ${true}
      ${Role.Consultant}                        | ${true}       | ${true}
      ${Role.ConsultantManager}                 | ${true}       | ${true}
      ${Role.Controller}                        | ${true}       | ${true}
      ${Role.FieldOperationsDirector}           | ${true}       | ${true}
      ${Role.FinancialAnalyst}                  | ${true}       | ${true}
      ${Role.Fundraising}                       | ${true}       | ${true}
      ${Role.Intern}                            | ${true}       | ${true}
      ${Role.LeadFinancialAnalyst}              | ${true}       | ${true}
      ${Role.Leadership}                        | ${true}       | ${true}
      ${Role.Liaison}                           | ${true}       | ${true}
      ${Role.Marketing}                         | ${true}       | ${true}
      ${Role.Mentor}                            | ${true}       | ${true}
      ${Role.ProjectManager}                    | ${true}       | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${true}       | ${true}
      ${Role.RegionalDirector}                  | ${true}       | ${true}
      ${Role.StaffMember}                       | ${true}       | ${true}
      ${Role.Translator}                        | ${true}       | ${true}
    `('$role', ({ role, globalCanList, projectCanList }) => {
      it('Global canList', async () => {
        const proj = await createProject(app);
        const lang = await runAsAdmin(
          app,
          async () =>
            await createLanguage(app, {
              sensitivity: Sensitivity.Low, // setting to low because we don't want it to effect the other lang engagements for testing
            })
        );
        await createLanguageEngagement(app, {
          projectId: proj.id,
          languageId: lang.id,
        });
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listLanguageEngagements(app);
        });
        if (!globalCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });

      it('Project canList', async () => {
        const user = await runInIsolatedSession(app, async () => {
          return await registerUser(app, {
            roles: [role],
          });
        });
        const proj = await createProject(app);
        const lang = await runAsAdmin(
          app,
          async () =>
            await createLanguage(app, {
              sensitivity: Sensitivity.Low, // setting to low because we don't want it to effect the other lang engagements for testing
            })
        );
        await createLanguageEngagement(app, {
          projectId: proj.id,
          languageId: lang.id,
        });
        await createProjectMember(app, {
          projectId: proj.id,
          roles: role,
          userId: user.id,
        });
        const read = await user.runAs(() => {
          return listLanguageEngagements(app);
        });
        if (!projectCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
});
