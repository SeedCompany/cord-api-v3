import { Connection } from 'cypher-query-builder';
import { Powers, Role } from '../../src/components/authorization';
import { Film } from '../../src/components/film';
import {
  createFilm,
  createSession,
  createTestApp,
  listFilms,
  readOneFilm,
  registerUser,
  registerUserWithPower,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';

describe('Film Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let testFilm: Film;
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(app, [Powers.CreateFilm, Powers.CreateProject]);
    testFilm = await createFilm(app);
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
        property                 | readFunction   | staticResource
        ${'scriptureReferences'} | ${readOneFilm} | ${Film}
        ${'name'}                | ${readOneFilm} | ${Film}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testFilm,
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
      role                                      | globalCanList
      ${Role.Administrator}                     | ${true}
      ${Role.Consultant}                        | ${true}
      ${Role.ConsultantManager}                 | ${true}
      ${Role.Controller}                        | ${true}
      ${Role.FieldOperationsDirector}           | ${true}
      ${Role.FinancialAnalyst}                  | ${true}
      ${Role.Fundraising}                       | ${true}
      ${Role.Intern}                            | ${true}
      ${Role.LeadFinancialAnalyst}              | ${true}
      ${Role.Leadership}                        | ${true}
      ${Role.Liaison}                           | ${true}
      ${Role.Marketing}                         | ${true}
      ${Role.Mentor}                            | ${true}
      ${Role.ProjectManager}                    | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${true}
      ${Role.RegionalDirector}                  | ${true}
      ${Role.StaffMember}                       | ${true}
      ${Role.Translator}                        | ${true}
    `('$role', ({ role, globalCanList }) => {
      it(`Global canList: ${globalCanList as string}`, async () => {
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listFilms(app);
        });
        if (!globalCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
});
