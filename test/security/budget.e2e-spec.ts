import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { Sensitivity } from '../../src/common';
import { Powers } from '../../src/components/authorization/dto/powers';
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
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { expectSensitivePropertyTranslationProject } from '../utility/sensitivity';

describe('Budget Security e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;
  let db: Connection;
  let email: string;
  let password: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateOrganization,
      Powers.CreateProject,
      Powers.CreatePartnership,
      Powers.CreateBudget,
    ]);
    project = await createProject(app);
    await createPartnership(app, {
      projectId: project.id,
      types: [PartnerType.Funding],
      financialReportingType: undefined,
    });
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
          resource: budget,
          sensitivityRestriction: Sensitivity.Medium,
          readOneFunction: readOneBudget,
        });
        await login(app, { email: email, password: password });
      });
    });
    describe('Records', () => {
      it('consultant manager role: medium', async () => {
        const proj = await createProject(app);
        const budget = await createBudget(app, { projectId: proj.id });

        await expectSensitivePropertyTranslationProject({
          app: app,
          role: Role.ConsultantManager,
          propertyToCheck: 'records',
          projectId: proj.id,
          resourceId: budget.id,
          resource: budget,
          sensitivityRestriction: Sensitivity.Medium,
          readOneFunction: readOneBudget,
        });
        await login(app, { email: email, password: password });
      });
    });
  });
});
