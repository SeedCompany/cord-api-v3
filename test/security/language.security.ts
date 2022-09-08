import {
  ResourceShape,
  SecuredListType,
  SecuredResource,
  SecuredResourceKey,
  Sensitivity,
} from '../../src/common';
import { Role, ScopedRole } from '../../src/components/authorization';
import { PermissionsOf } from '../../src/components/authorization/authorization.service';
import {
  EthnologueLanguage,
  Language,
} from '../../src/components/language/dto';
import { Location, SecuredLocationList } from '../../src/components/location';
import { Project } from '../../src/components/project';
import {
  addLocationToLanguage,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listLanguageIds,
  Raw,
  readOneLanguage,
  readOneLanguageEthnologue,
  readOneLanguageLocation,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { testRole } from '../utility/roles';
import { ReadOneFunction, ResourceArrayRelation } from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Language Security e2e', () => {
  let app: TestApp;
  let testLanguage: Language;
  let testLocation: Location;
  let testProject: Raw<Project>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    [testLocation, testLanguage] = await runAsAdmin(app, async () => {
      const loc = await createLocation(app);
      const lang = await createLanguage(app, { sensitivity: Sensitivity.Low });
      return [loc, lang];
    });
    testProject = await createProject(app);
    await addLocationToLanguage(app, testLocation.id, testLanguage.id);
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
        property                       | readFunction                 | staticResource
        ${'displayName'}               | ${readOneLanguage}           | ${Language}
        ${'displayNamePronunciation'}  | ${readOneLanguage}           | ${Language}
        ${'isDialect'}                 | ${readOneLanguage}           | ${Language}
        ${'isSignLanguage'}            | ${readOneLanguage}           | ${Language}
        ${'leastOfThese'}              | ${readOneLanguage}           | ${Language}
        ${'name'}                      | ${readOneLanguage}           | ${Language}
        ${'leastOfTheseReason'}        | ${readOneLanguage}           | ${Language}
        ${'populationOverride'}        | ${readOneLanguage}           | ${Language}
        ${'registryOfDialectsCode'}    | ${readOneLanguage}           | ${Language}
        ${'signLanguageCode'}          | ${readOneLanguage}           | ${Language}
        ${'sponsorEstimatedEndDate'}   | ${readOneLanguage}           | ${Language}
        ${'hasExternalFirstScripture'} | ${readOneLanguage}           | ${Language}
        ${'tags'}                      | ${readOneLanguage}           | ${Language}
        ${'code'}                      | ${readOneLanguageEthnologue} | ${EthnologueLanguage}
        ${'name'}                      | ${readOneLanguageEthnologue} | ${EthnologueLanguage}
        ${'population'}                | ${readOneLanguageEthnologue} | ${EthnologueLanguage}
        ${'provisionalCode'}           | ${readOneLanguageEthnologue} | ${EthnologueLanguage}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testLanguage,
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            skipEditCheck: false,
          });
        }
      );

      it('reading locations', async () => {
        const perms = await getPermissions({
          resource: Language,
          userRole: `global:${role as Role}` as ScopedRole,
          sensitivity: testLanguage.sensitivity,
        });

        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await readOneLanguageLocation(app, testLanguage.id);
        });

        expect(read.canRead).toEqual(perms.locations.canRead);
        expect(read.canCreate).toEqual(perms.locations.canEdit);
        if (!perms.locations.canRead) {
          expect(read.items).toHaveLength(0);
        } else {
          expect(read.items).not.toHaveLength(0);
        }
      });
    });
  });

  describe('Listing is secure', () => {
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
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listLanguageIds(app);
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
        await createProjectMember(app, {
          projectId: testProject.id,
          roles: role,
          userId: user.id,
        });
        await createLanguageEngagement(app, { projectId: testProject.id });
        const read = await user.runAs(() => {
          return listLanguageIds(app);
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
      role                      | sensitivityToTest
      ${Role.ConsultantManager} | ${Sensitivity.Medium}
      ${Role.Marketing}         | ${Sensitivity.Low}
      ${Role.Fundraising}       | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property                    | resource              | readFunction
          ${'registryOfDialectsCode'} | ${Language}           | ${readOneLanguage}
          ${'signLanguageCode'}       | ${Language}           | ${readOneLanguage}
          ${'code'}                   | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
          ${'name'}                   | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
          ${'population'}             | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
          ${'provisionalCode'}        | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
        `(
          ' reading $resource.name $property',
          async ({ property, resource, readFunction }) => {
            await testSensitivityLowerThanEqualTo(
              app,
              sensitivityToTest,
              property,
              readFunction,
              role,
              resource
            );
            await testSensitivityHigherThan(
              app,
              sensitivityToTest,
              resource,
              property,
              role,
              readFunction
            );
          }
        );
      }
    );

    describe.each`
      role                         | sensitivityToTest
      ${Role.StaffMember}          | ${Sensitivity.Low}
      ${Role.Marketing}            | ${Sensitivity.Low}
      ${Role.Fundraising}          | ${Sensitivity.Medium}
      ${Role.ConsultantManager}    | ${Sensitivity.Medium}
      ${Role.FinancialAnalyst}     | ${Sensitivity.Low}
      ${Role.LeadFinancialAnalyst} | ${Sensitivity.Medium}
      ${Role.Controller}           | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        it('reading locations', async () => {
          await testSensitivityHigherThan(
            app,
            sensitivityToTest,
            Language,
            'locations',
            role,
            readOneLanguageLocation
          );
          await testSensitivityLowerThanEqualTo(
            app,
            sensitivityToTest,
            'locations',
            readOneLanguageLocation,
            role,
            Language
          );
        });
      }
    );
  });
});

async function testSensitivityHigherThan<
  TResource extends ResourceShape<any>,
  Prop extends SecuredResourceKey<TResource>
>(
  app: TestApp,
  sensitivity: Sensitivity,
  resource: TResource,
  property: Prop,
  role: Role,
  readFunction:
    | (Prop extends keyof TResource['prototype']
        ? ReadOneFunction<TResource['prototype']>
        : never)
    | (Prop extends keyof TResource['Relations'] & string
        ? ReadOneFunction<
            SecuredListType<ResourceArrayRelation<TResource, Prop>>
          >
        : never)
) {
  const isRelationList = resource.Relations && property in resource.Relations;

  const [medSenslanguage, highSenslanguage] = await runAsAdmin(
    app,
    async () => {
      return [
        await createLanguage(app, {
          sensitivity: Sensitivity.Medium,
        }),
        await createLanguage(app, {
          sensitivity: Sensitivity.High,
        }),
      ];
    }
  );

  const [medRead, highRead] = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [role] });
    return [
      await readFunction(app, medSenslanguage.id),
      await readFunction(app, highSenslanguage.id),
    ];
  });

  async function expectPropSensitivity(read: TResource['prototype']) {
    expect(read[property].canRead).toBeFalsy();
    expect(read[property].canEdit).toBeFalsy();
  }

  async function expectLocationList(
    read: SecuredLocationList,
    canRead: boolean
  ) {
    if (canRead) {
      expect(read.items).not.toHaveLength(0);
    } else {
      expect(read.items).toHaveLength(0);
    }
  }

  switch (sensitivity) {
    case Sensitivity.Low: {
      if (isRelationList) {
        const medPerms = await getPermissions({
          resource: resource,
          userRole: `global:${role}` as ScopedRole,
          sensitivity: medSenslanguage.sensitivity,
        });
        const highPerms = await getPermissions({
          resource: resource,
          userRole: `global:${role}` as ScopedRole,
          sensitivity: highSenslanguage.sensitivity,
        });
        await expectLocationList(medRead, medPerms[property].canRead);
        await expectLocationList(highRead, highPerms[property].canRead);
      } else {
        await expectPropSensitivity(medRead);
        await expectPropSensitivity(highRead);
      }
      break;
    }
    case Sensitivity.Medium: {
      if (isRelationList) {
        const highPerms = await getPermissions({
          resource: resource,
          userRole: `global:${role}` as ScopedRole,
          sensitivity: highSenslanguage.sensitivity,
        });
        await expectLocationList(highRead, highPerms[property].canRead);
      } else {
        await expectPropSensitivity(highRead);
      }
      break;
    }
    case Sensitivity.High: {
      // nothing higher than High, so just break.
      break;
    }
  }
}

async function testSensitivityLowerThanEqualTo<
  TResource extends ResourceShape<any>,
  Prop extends SecuredResourceKey<TResource>
>(
  app: TestApp,
  sensitivity: Sensitivity,
  property: Prop,
  readFunction:
    | (Prop extends keyof TResource['prototype']
        ? ReadOneFunction<TResource['prototype']>
        : never)
    | (Prop extends keyof TResource['Relations'] & string
        ? ReadOneFunction<
            SecuredListType<ResourceArrayRelation<TResource, Prop>>
          >
        : never),
  role: Role,
  resource: TResource
) {
  const isRelationList = resource.Relations && property in resource.Relations;

  //test languages with sensitivity lower than/equal to what we're testing.
  const highSenslanguage = await runAsAdmin(
    app,
    async () =>
      await createLanguage(app, {
        sensitivity: Sensitivity.High,
      })
  );
  const highPerms = await getPermissions({
    resource: resource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: highSenslanguage.sensitivity,
  });

  const medSenslanguage = await runAsAdmin(
    app,
    async () =>
      await createLanguage(app, {
        sensitivity: Sensitivity.Medium,
      })
  );
  const medPerms = await getPermissions({
    resource: resource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: medSenslanguage.sensitivity,
  });
  const lowSenslanguage = await runAsAdmin(
    app,
    async () =>
      await createLanguage(app, {
        sensitivity: Sensitivity.Low,
      })
  );
  const lowPerms = await getPermissions({
    resource: resource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: lowSenslanguage.sensitivity,
  });

  const [readHigh, readMed, readLow] = await runInIsolatedSession(
    app,
    async () => {
      await registerUser(app, { roles: [role] });
      return [
        await readFunction(app, highSenslanguage.id),
        await readFunction(app, medSenslanguage.id),
        await readFunction(app, lowSenslanguage.id),
      ];
    }
  );

  async function expectPropSensitivity(
    read: TResource['prototype'],
    perms: PermissionsOf<SecuredResource<TResource>>
  ) {
    expect(read[property].canRead).toEqual(perms[property].canRead);
    expect(read[property].canEdit).toEqual(perms[property].canEdit);
  }

  async function expectRelationList(
    read: SecuredLocationList,
    perms: PermissionsOf<SecuredResource<TResource>>
  ) {
    if (perms[property].canRead) {
      expect(read.items).toHaveLength(0);
      expect(read.canCreate).toEqual(perms[property].canEdit);
    } else {
      expect(read.items).not.toHaveLength(0);
      expect(read.canCreate).toEqual(perms[property].canEdit);
    }
  }

  switch (sensitivity) {
    case Sensitivity.High: {
      if (isRelationList) {
        await expectRelationList(readHigh, highPerms);
      } else {
        await expectPropSensitivity(readHigh, highPerms);
      }
    }
    // disabling fallthrough because I for realz want to do it. I want to create High, Med, and Low for the high sensitivity case
    //    keeps me from having to repeat code
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Medium: {
      if (isRelationList) {
        await expectRelationList(readMed, medPerms);
      } else {
        await expectPropSensitivity(readMed, medPerms);
      }
    }
    // I for realz want to fallthrough, because I want to create medium and low for medium sensitivity
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Low: {
      if (isRelationList) {
        await expectRelationList(readLow, lowPerms);
      } else {
        await expectPropSensitivity(readLow, lowPerms);
      }
    }
  }
}
