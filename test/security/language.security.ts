import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { ResourceShape, SecuredResource, Sensitivity } from '../../src/common';
import { PermissionsOf } from '../../src/components/authorization/authorization.service';
import { Powers } from '../../src/components/authorization/dto/powers';
import {
  EthnologueLanguage,
  Language,
} from '../../src/components/language/dto';
import { Location, SecuredLocationList } from '../../src/components/location';
import { Role, ScopedRole } from '../../src/components/project';
import {
  addLocationToLanguage,
  createLanguage,
  createLocation,
  createSession,
  createTestApp,
  login,
  readOneLanguage,
  readOneLanguageEthnologue,
  readOneLanguageLocation,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';
import {
  ReadOneFunction,
  ReadOneRelationArray,
  SecuredList,
} from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Language Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let email: string;
  let password: string;
  let testLanguage: Language;
  let testLocation: Location;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(
      app,
      [
        Powers.CreateLanguage,
        Powers.CreateLocation,
        Powers.CreateEthnologueLanguage,
      ],
      { email: email, password: password }
    );
    testLocation = await createLocation(app);
    testLanguage = await createLanguage(app, { sensitivity: Sensitivity.Low });
    await addLocationToLanguage(app, testLocation.id, testLanguage.id);
  });

  afterAll(async () => {
    await resetDatabase(db);
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
          });
        }
      );

      it('reading locations', async () => {
        await login(app, { email, password });
        await registerUserWithPower(app, [], { roles: role });
        const perms = await getPermissions({
          resource: Language,
          userRole: `global:${role as Role}` as ScopedRole,
          sensitivity: testLanguage.sensitivity,
        });

        const read = await readOneLanguageLocation(app, testLanguage.id);

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
            await login(app, { email: email, password: password });
            await testSensitivityLowerThanEqualTo(
              app,
              sensitivityToTest,
              property,
              readFunction,
              role,
              resource
            );
            await login(app, { email, password });
            await testSensitivityHigherThan(
              app,
              sensitivityToTest,
              resource,
              property,
              role,
              readFunction
            );
            await login(app, { email, password });
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
          await login(app, { email, password });
          await testSensitivityHigherThan(
            app,
            sensitivityToTest,
            Language,
            'locations',
            role,
            readOneLanguageLocation,
            true
          );
          await login(app, { email, password });
          await testSensitivityLowerThanEqualTo(
            app,
            sensitivityToTest,
            'locations',
            readOneLanguageLocation,
            role,
            Language,
            true
          );
        });
      }
    );
  });
});

async function testSensitivityHigherThan<TResource extends ResourceShape<any>>(
  app: TestApp,
  sensitivity: Sensitivity,
  resource: TResource,
  property: keyof TResource['prototype'] | keyof TResource['Relations'],
  role: Role,
  readFunction: ReadOneFunction<TResource['prototype']> | ReadOneRelationArray,
  isRelationList = false
) {
  const medSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.Medium,
  });
  const highSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.High,
  });

  await registerUserWithPower(app, [], { roles: [role] });
  const medRead = await readFunction(app, medSenslanguage.id);
  const highRead = await readFunction(app, highSenslanguage.id);

  async function expectPropSensitivity(read: TResource['prototype']) {
    expect(read[property].canRead).toBeFalsy();
    expect(read[property].canEdit).toBeFalsy();
  }

  async function expectLocationList(
    read: SecuredList<Location>,
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
        await expectLocationList(
          medRead as SecuredList<Location>,
          medPerms[property].canRead
        );
        await expectLocationList(
          highRead as SecuredList<Location>,
          highPerms[property].canRead
        );
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
        await expectLocationList(
          highRead as SecuredList<Location>,
          highPerms[property].canRead
        );
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
  TResource extends ResourceShape<any>
>(
  app: TestApp,
  sensitivity: Sensitivity,
  property: keyof TResource['prototype'] | keyof TResource['Relations'],
  readFunction: ReadOneFunction<TResource['prototype']> | ReadOneRelationArray,
  role: Role,
  resource: TResource,
  isRelationList = false
) {
  //test languages with sensitivity lower than/equal to what we're testing.
  const highSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.High,
  });
  const highPerms = await getPermissions({
    resource: resource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: highSenslanguage.sensitivity,
  });

  const medSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.Medium,
  });
  const medPerms = await getPermissions({
    resource: resource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: medSenslanguage.sensitivity,
  });
  const lowSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.Low,
  });
  const lowPerms = await getPermissions({
    resource: resource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: lowSenslanguage.sensitivity,
  });
  await registerUserWithPower(app, [], { roles: [role] });
  const readHigh = await readFunction(app, highSenslanguage.id);
  const readMed = await readFunction(app, medSenslanguage.id);
  const readLow = await readFunction(app, lowSenslanguage.id);

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
        await expectRelationList(readHigh as SecuredList<Location>, highPerms);
      } else {
        await expectPropSensitivity(readHigh, highPerms);
      }
    }
    // disabling fallthrough because I for realz want to do it. I want to create High, Med, and Low for the high sensitivity case
    //    keeps me from having to repeat code
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Medium: {
      if (isRelationList) {
        await expectRelationList(readMed as SecuredList<Location>, medPerms);
      } else {
        await expectPropSensitivity(readMed, medPerms);
      }
    }
    // I for realz want to fallthrough, because I want to create medium and low for medium sensitivity
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Low: {
      if (isRelationList) {
        await expectRelationList(readLow as SecuredList<Location>, lowPerms);
      } else {
        await expectPropSensitivity(readLow, lowPerms);
      }
    }
  }
}
