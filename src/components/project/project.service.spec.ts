import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CalendarDate } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { Project, ProjectType } from './dto';
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(),
        CoreModule,
        ProjectService,
        ProjectMemberService,
      ],
      providers: [
        ProjectService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
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
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(project.name).toEqual(createTestProject.name);
    expect(project.type).toEqual(createTestProject.type);
    expect(project.mouStart).toEqual(createTestProject.mouStart);
    expect(project.mouEnd).toEqual(createTestProject.mouEnd);
    expect(project.estimatedSubmission).toEqual(
      createTestProject.estimatedSubmission
    );
  });
});
