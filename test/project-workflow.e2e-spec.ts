/* eslint-disable @seedcompany/no-unused-vars */
import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import { FieldRegion } from '../src/components/field-region';
import { FieldZone } from '../src/components/field-zone';
import { Location } from '../src/components/location';
import * as faker from 'faker';
import { CalendarDate, Sensitivity } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { PartnerType } from '../src/components/partner';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  Role,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createBudget,
  createLanguageEngagement,
  createLocation,
  createPartner,
  createPartnership,
  createPerson,
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  fragments,
  login,
  registerUser,
  registerUserWithPower,
  TestApp,
  updateProject,
} from './utility';
import { resetDatabase } from './utility/reset-database';
import { createProduct } from './utility/create-product';
import { changeProjectStep } from './utility/transition-project';

describe('Project-Workflow e2e', () => {
  let app: TestApp;
  let password: string;
  let director: User;
  let fieldZone: FieldZone;
  let fieldRegion: FieldRegion;
  let location: Location;
  let db: Connection;
  let projectManager: User;
  let consultantManager: User;
  let financialAnalyst: User;
  let financialAnalystController: User;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    password = faker.internet.password();

    // Register several testers with different roles
    director = await registerUser(app, {
      roles: [Role.RegionalDirector, Role.FieldOperationsDirector],
      password: password,
    });
    projectManager = await registerUserWithPower(
      app,
      [
        Powers.CreateLanguage,
        Powers.CreateEthnologueLanguage,
        Powers.CreateOrganization,
      ],
      {
        roles: [Role.ProjectManager],
        password: password,
      }
    );
    consultantManager = await registerUser(app, {
      roles: [Role.Consultant, Role.ConsultantManager],
      password: password,
    });
    financialAnalyst = await registerUser(app, {
      roles: [Role.FinancialAnalyst],
      password: password,
    });
    financialAnalystController = await registerUser(app, {
      roles: [Role.FinancialAnalyst, Role.Controller],
      password: password,
    });

    await login(app, { email: projectManager.email.value, password });
  });
  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('should have project step', async () => {
    const project = await createProject(app);
    expect(project.step.value).toBe(ProjectStep.EarlyConversations);
  });

  it('should have project status', async () => {
    const project = await createProject(app);
    expect(project.status).toBe(ProjectStatus.InDevelopment);
  });

  it('should have default status as Pending for first budget with project creation', async () => {
    const type = ProjectType.Translation;
    const project = await createProject(app, { type });

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            budget {
              value {
                id
                status
              }
              canRead
              canEdit
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );
    expect(queryProject.project.budget.value.status).toBe('Pending');
  });

  describe('Workflow', () => {
    it('should test project workflow', async () => {
      /**
       * Step1. Create Project
       *  */
      // Create a new person
      const person = await createPerson(app);
      expect(person.id).toBeDefined();

      // Create a new project (single language)
      const project = await createProject(app);
      let languageEngagement = await createLanguageEngagement(app, {
        projectId: project.id,
      });
      expect(languageEngagement.id).toBeDefined();

      // Create a new project (cluster)
      languageEngagement = await createLanguageEngagement(app, {
        projectId: project.id,
      });
      expect(languageEngagement.id).toBeDefined();

      // Enter location and field region
      const location = await createLocation(app);
      const fieldRegion = await createRegion(app);
      let result = await updateProject(app, {
        id: project.id,
        primaryLocationId: location.id,
        fieldRegionId: fieldRegion.id,
      });
      expect(result.primaryLocation.value.id).toBe(location.id);
      expect(result.fieldRegion.value.id).toBe(fieldRegion.id);

      // Enter MOU dates
      await login(app, { email: director.email.value, password });
      result = await updateProject(app, {
        id: project.id,
        mouStart: CalendarDate.fromISO('1991-01-01'),
        mouEnd: CalendarDate.fromISO('1992-01-01'),
      });
      expect(result.mouStart.value).toBe('1991-01-01');
      expect(result.mouEnd.value).toBe('1992-01-01');

      // Enter estimatedSubmission date
      result = await updateProject(app, {
        id: project.id,
        estimatedSubmission: CalendarDate.fromISO('2020-01-01'),
      });
      expect(result.estimatedSubmission.value).toBe('2020-01-01');

      // Enter Field budget
      const budget = await createBudget(app, { projectId: project.id });
      result = await app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              ...project
              budget {
                value {
                  ...budget
                }
              }
            }
          }
          ${fragments.project}
          ${fragments.budget}
        `,
        {
          id: project.id,
        }
      );
      expect(result.project.budget.value.id).toBe(budget.id);
      expect(result.project.step.value).toBe(ProjectStep.EarlyConversations);

      // TODO: Upload mock UBT file
      // TODO: Upload mock Approval docs
      // Add team members
      const projectMember = await createProjectMember(app, {
        projectId: project.id,
        userId: person.id,
      });
      expect(projectMember.user.value?.id).toBe(person.id);

      // Add partners
      await login(app, { email: projectManager.email.value, password });
      const partner = await createPartner(app, {
        types: [PartnerType.Funding, PartnerType.Impact, PartnerType.Technical],
        financialReportingTypes: [],
      });
      await createPartnership(app, {
        partnerId: partner.id,
        projectId: project.id,
        financialReportingType: undefined,
      });

      // Select sensitivity (Cannot update sensitivity if the project type is translation)
      // result = await updateProject(app, {
      //   id: project.id,
      //   sensitivity: Sensitivity.Medium,
      // });
      // expect(result.sensitivity).toBe(Sensitivity.Medium);

      // Add products
      await createProduct(app, {
        engagementId: languageEngagement.id,
      });

      /**
       * Step2. Approval Workflow
       *  */
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConceptApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForConsultantEndorsement
      );
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConsultantEndorsement
      );

      // Login as Consultant Manager
      await login(app, { email: consultantManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForFinancialEndorsement
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinancialEndorsement
      );

      // Login as Financial Analyst
      await login(app, { email: financialAnalyst.email.value, password });
      await changeProjectStep(app, project.id, ProjectStep.FinalizingProposal);

      // Login as Project Manager
      await login(app, { email: projectManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingRegionalDirectorApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinanceConfirmation
      );

      // Login as Controller
      await login(app, {
        email: financialAnalystController.email.value,
        password,
      });
      await changeProjectStep(app, project.id, ProjectStep.Active);

      /**
       * Step3. Change to Plan Workflow
       *  */
      // Login as Project Manager
      await login(app, { email: projectManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.DiscussingChangeToPlan
      );
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingChangeToPlanApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(app, project.id, ProjectStep.ActiveChangedPlan);
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.FinalizingCompletion
      );

      // Login as Financial Analyst
      await login(app, { email: financialAnalyst.email.value, password });
      await changeProjectStep(app, project.id, ProjectStep.Completed);

      result = await app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              ...project
            }
          }
          ${fragments.project}
        `,
        {
          id: project.id,
        }
      );
      expect(result.project.step.value).toBe(ProjectStep.Completed);
      expect(result.project.status).toBe(ProjectStatus.Completed);
    });
  });
});
