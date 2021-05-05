import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers } from '../../src/components/authorization/dto/powers';
import { Budget, BudgetRecord } from '../../src/components/budget';
import { PartnerType } from '../../src/components/partner';
import { Project, Role } from '../../src/components/project';
import {
  createBudget,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  login,
  Raw,
  readOneBudget,
  readOneBudgetRecord,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { expectSensitivePropertyTranslationProject } from '../utility/sensitivity';

describe('Budget Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let email: string;
  let password: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(
      app,
      [
        Powers.CreateOrganization,
        Powers.CreateProject,
        Powers.CreatePartnership,
        Powers.CreateBudget,
      ],
      { email: email, password: password }
    );
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  describe('Security restricted by Sensitivity', () => {
    describe('universal template file', () => {
      it('consultant manager role: medium', async () => {
        const proj = await createProject(app);
        const budget = await createBudget(app, { projectId: proj.id });


        await expectSensitivePropertyTranslationProject({
          app,
          role: Role.ConsultantManager,
          propertyToCheck: 'universalTemplateFile',
          projectId: proj.id,
          resourceId: budget.id,
          resource: Budget,
          sensitivityRestriction: Sensitivity.Medium,
          readOneFunction: readOneBudget,
        });
      });
    });
    // describe('Records', () => {
    //   it('consultant manager role: medium', async () => {
    //     await login(app, { email: email, password: password });
    //     const proj = await createProject(app);
    //     const budget = await createBudget(app, { projectId: proj.id });

    //     await createPartnership(app, {
    //       projectId: proj.id,
    //       types: [PartnerType.Funding, PartnerType.Managing],
    //       financialReportingType: undefined,
    //       mouStartOverride: CalendarDate.fromISO('2000-01-01'),
    //       mouEndOverride: CalendarDate.fromISO('2004-01-01'),
    //     });

    //     await expectSensitivePropertyTranslationProject({
    //       app: app,
    //       role: Role.ConsultantManager,
    //       propertyToCheck: 'amount',
    //       projectId: proj.id,
    //       resourceId: budget.id,
    //       resource: BudgetRecord,
    //       sensitivityRestriction: Sensitivity.Medium,
    //       readOneFunction: readOneBudgetRecord,
    //     });
    //     await login(app, { email: email, password: password });
    //   });
    // });
  });
});
