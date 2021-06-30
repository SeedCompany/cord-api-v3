import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate } from '../../src/common';
import { Powers } from '../../src/components/authorization/dto/powers';
import { PartnerType } from '../../src/components/partner';
import { Project, Role } from '../../src/components/project';
import {
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listPartners,
  login,
  Raw,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';

describe('Project Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let email: string;
  let password: string;
  let testProject: Raw<Project>;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(
      app,
      [
        Powers.CreateProject,
        Powers.CreateLanguage,
        Powers.CreateLanguageEngagement,
        Powers.CreateEthnologueLanguage,
        Powers.CreateOrganization,
        Powers.CreatePartner,
        Powers.CreatePartnership,
      ],
      { email: email, password: password }
    );
    testProject = await createProject(app);
    const org = await createOrganization(app);
    const partnerWithProject = await createPartner(app, {
      organizationId: org.id,
    });
    await createPartnership(app, {
      partnerId: partnerWithProject.id,
      projectId: testProject.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      financialReportingType: undefined,
      mouStartOverride: CalendarDate.fromISO('2000-01-01'),
      mouEndOverride: CalendarDate.fromISO('2004-01-01'),
    });
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  describe('Restricted by role', () => {
    describe.each`
      role                                      | globalCanList | projectCanList
      ${Role.Administrator}                     | ${true}       | ${true}
      ${Role.Consultant}                        | ${false}      | ${false}
      ${Role.ConsultantManager}                 | ${true}       | ${true}
      ${Role.Controller}                        | ${true}       | ${true}
      ${Role.FieldOperationsDirector}           | ${true}       | ${true}
      ${Role.FinancialAnalyst}                  | ${true}       | ${true}
      ${Role.Fundraising}                       | ${true}       | ${true}
      ${Role.Intern}                            | ${true}       | ${true}
      ${Role.LeadFinancialAnalyst}              | ${true}       | ${true}
      ${Role.Leadership}                        | ${true}       | ${true}
      ${Role.Liaison}                           | ${false}      | ${false}
      ${Role.Marketing}                         | ${true}       | ${true}
      ${Role.Mentor}                            | ${true}       | ${true}
      ${Role.ProjectManager}                    | ${true}       | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${false}      | ${false}
      ${Role.RegionalDirector}                  | ${true}       | ${true}
      ${Role.StaffMember}                       | ${true}       | ${true}
      ${Role.Translator}                        | ${false}      | ${false}
    `('$role', ({ role, globalCanList, projectCanList }) => {
      it('Global canList', async () => {
        await registerUserWithPower(app, [], { roles: role });
        const read = await listPartners(app);
        if (!globalCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });

      it('Project canList', async () => {
        const userEmail = faker.internet.email();
        const userPassword = faker.internet.password();
        const user = await registerUserWithPower(app, [], {
          email: userEmail,
          password: userPassword,
          roles: role,
        });
        await login(app, { email, password });
        const org1 = await createOrganization(app);
        await createPartner(app, {
          organizationId: org1.id,
        });
        const org2 = await createOrganization(app);
        await createPartner(app, {
          organizationId: org2.id,
        });
        await createProjectMember(app, {
          projectId: testProject.id,
          roles: role,
          userId: user.id,
        });
        await login(app, { email: userEmail, password: userPassword });
        const read = await listPartners(app);
        if (!projectCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
});
