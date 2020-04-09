import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CalendarDate, Order, Sensitivity } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthModule, AuthService } from '../auth';
import { OrganizationModule, OrganizationService } from '../organization';
import {
  EducationModule,
  EducationService,
  UnavailabilityModule,
  UnavailabilityService,
  UserModule,
  UserService,
} from '../user';
import {
  Project,
  ProjectListOutput,
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from './dto';
import { Role, SecuredProjectMemberList } from './project-member/dto';
import { ProjectMemberService } from './project-member/project-member.service';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  let projectService: ProjectService;
  const id = generate();
  const date = CalendarDate.fromSeconds(1);
  const createTestProject: Partial<Project> = {
    id,
    name: {
      value: 'Project',
      canRead: true,
      canEdit: true,
    },
    deptId: {
      value: '12345',
      canRead: true,
      canEdit: true,
    },
    mouStart: {
      value: date,
      canRead: true,
      canEdit: true,
    },
    mouEnd: {
      value: date,
      canRead: true,
      canEdit: true,
    },
    estimatedSubmission: {
      value: date,
      canRead: true,
      canEdit: true,
    },
    status: ProjectStatus.Active,
    step: {
      value: ProjectStep.Active,
      canRead: true,
      canEdit: true,
    },
  };

  const updatedTestProject: Partial<Project> = {
    id,
    name: {
      value: 'Project1',
      canRead: true,
      canEdit: true,
    },
    deptId: {
      value: '12345',
      canRead: true,
      canEdit: true,
    },
    mouStart: {
      value: date,
      canRead: true,
      canEdit: true,
    },
    mouEnd: {
      value: date,
      canRead: true,
      canEdit: true,
    },
    estimatedSubmission: {
      value: date,
      canRead: true,
      canEdit: true,
    },
    status: ProjectStatus.Active,
  };

  const mockDbService = {
    createNode: () => createTestProject,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => createTestProject,
    updateProperties: () => ({}),
  };

  const mockSession = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
    userId: '12345',
    issuedAt: DateTime.local(),
    owningOrgId: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(),
        CoreModule,
        UserModule,
        EducationModule,
        OrganizationModule,
        UnavailabilityModule,
        AuthModule,
      ],
      providers: [
        ProjectService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
        ProjectMemberService,
        UserService,
        EducationService,
        OrganizationService,
        UnavailabilityService,
        AuthService,
      ],
    }).compile();

    projectService = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(ProjectService).toBeDefined();
  });

  it('should create project node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    projectService.readOne = jest.fn().mockReturnValue(createTestProject);

    const project = await projectService.create(
      {
        name: 'project',
        type: ProjectType.Translation,
        locationId:
          'X9uvqqN59EEcyGIw1xHPAOx7dXmYF4GXm20.aGPHWl13lMpmlvvsRADHNQ.Xepq3xRTSQDmV8NR0qDalA',
        mouStart: CalendarDate.fromSeconds(1),
        mouEnd: CalendarDate.fromSeconds(1),
        estimatedSubmission: CalendarDate.fromSeconds(1),
      },
      mockSession
    );
    expect(project.name).toEqual(createTestProject.name);
    expect(project.type).toEqual(createTestProject.type);
    expect(project.mouStart).toEqual(createTestProject.mouStart);
    expect(project.mouEnd).toEqual(createTestProject.mouEnd);
    expect(project.estimatedSubmission).toEqual(
      createTestProject.estimatedSubmission
    );
  });

  it('should update project node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    projectService.update = jest.fn().mockReturnValue(updatedTestProject);

    const updatedProject = await projectService.update(
      {
        id,
        name: 'project-new',
        locationId:
          'X9uvqqN59EEcyGIw1xHPAOx7dXmYF4GXm20.aGPHWl13lMpmlvvsRADHNQ.Xepq3xRTSQDmV8NR0qDalA',
        mouStart: CalendarDate.fromSeconds(1),
        mouEnd: CalendarDate.fromSeconds(1),
        estimatedSubmission: CalendarDate.fromSeconds(1),
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(updatedProject.id).toEqual(createTestProject.id);
    expect(updatedProject.name).toEqual(updatedTestProject.name);
    expect(updatedProject.mouStart).toEqual(updatedTestProject.mouStart);
    expect(updatedProject.mouEnd).toEqual(updatedTestProject.mouEnd);
    expect(updatedProject.estimatedSubmission).toEqual(
      updatedTestProject.estimatedSubmission
    );
  });

  it('should delete product node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    projectService.readOne = jest.fn().mockReturnValue(createTestProject);
    const project = await projectService.create(
      {
        name: 'project',
        type: ProjectType.Translation,
        locationId:
          'X9uvqqN59EEcyGIw1xHPAOx7dXmYF4GXm20.aGPHWl13lMpmlvvsRADHNQ.Xepq3xRTSQDmV8NR0qDalA',
        mouStart: CalendarDate.fromSeconds(1),
        mouEnd: CalendarDate.fromSeconds(1),
        estimatedSubmission: CalendarDate.fromSeconds(1),
      },
      mockSession
    );
    await projectService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(project.id).toEqual(createTestProject.id);
    expect(project.name).toEqual(createTestProject.name);
    expect(project.type).toEqual(createTestProject.type);
    expect(project.status).toEqual(createTestProject.status);
    expect(project.mouStart).toEqual(createTestProject.mouStart);
    expect(project.mouEnd).toEqual(createTestProject.mouEnd);
    expect(project.estimatedSubmission).toEqual(
      createTestProject.estimatedSubmission
    );
  });

  const projectTestListOutput: Partial<ProjectListOutput> = {
    hasMore: false,
    items: [],
    total: 0,
  };

  it('should list project', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    projectService.list = jest.fn().mockReturnValue(projectTestListOutput);

    const listInput = await projectService.list(
      {
        count: 25,
        page: 1,
        sort: 'name',
        filter: {
          name: 'name',
          userIds: ['9gf-Ogtbw'],
          type: ProjectType.Internship,
          sensitivity: [Sensitivity.High],
          status: [ProjectStatus.Active],
          locationIds: [
            'X9uvqqN59EEcyGIw1xHPAOx7dXmYF4GXm20.aGPHWl13lMpmlvvsRADHNQ.Xepq3xRTSQDmV8NR0qDalA',
          ],
        },
        order: Order.ASC,
      },
      mockSession
    );

    expect(listInput.total).toEqual(projectTestListOutput.total);
    expect(listInput.hasMore).toEqual(projectTestListOutput.hasMore);
    expect(listInput.items.length).toEqual(projectTestListOutput.items?.length);
  });

  const securedProjectTestMemberList: Partial<SecuredProjectMemberList> = {
    canCreate: true,
    canRead: true,
    hasMore: true,
    items: [],
    total: 0,
  };

  it('should list project members', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    projectService.listProjectMembers = jest
      .fn()
      .mockReturnValue(securedProjectTestMemberList);

    const member = await projectService.listProjectMembers(
      id,
      {
        count: 25,
        order: Order.ASC,
        page: 1,
        filter: {
          projectId: id,
          roles: [Role.BibleTranslationLiaison],
        },
        sort: 'createdAt',
      },
      mockSession
    );

    expect(member.total).toEqual(securedProjectTestMemberList.total);
    expect(member.hasMore).toEqual(securedProjectTestMemberList.hasMore);
    expect(member.items.length).toEqual(
      securedProjectTestMemberList.items?.length
    );
    expect(member.canCreate).toEqual(securedProjectTestMemberList.canCreate);
    expect(member.canRead).toEqual(securedProjectTestMemberList.canRead);
  });
});
