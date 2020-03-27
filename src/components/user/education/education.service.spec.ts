import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../../core';
import { Degree, Education } from './dto';
import { EducationService } from './education.service';

describe('EducationService', () => {
  let educationService: EducationService;
  const id = generate();

  const createTestEducation: Partial<Education> = {
    id,
    degree: {
      value: Degree.Associates,
      canRead: true,
      canEdit: true,
    },
    major: {
      value: 'Electronic',
      canRead: true,
      canEdit: true,
    },
    institution: {
      value: 'Cambridge',
      canRead: true,
      canEdit: true,
    },
  };

  // const updateTestEducation: Partial<Education> = {
  //   id,
  //   degree: {
  //     value: 'MTECH',
  //     canRead: true,
  //     canEdit: true,
  //   },
  //   major: {
  //     value: 'Electronic',
  //     canRead: true,
  //     canEdit: true,
  //   },
  //   institution: {
  //     value: 'Cambridge',
  //     canRead: true,
  //     canEdit: true,
  //   },
  // };

  const mockDbService = {
    createNode: () => createTestEducation,
    updateProperties: () => createTestEducation,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => ({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule],
      providers: [
        EducationService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    educationService = module.get<EducationService>(EducationService);
  });

  it('should be defined', () => {
    expect(EducationService).toBeDefined();
  });

  it('should create education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue({});
    const education = await educationService.create(
      {
        userId: 'abcd',
        degree: Degree.Associates,
        major: 'Electronic',
        institution: 'Cambridge',
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(education.institution).toEqual(createTestEducation.institution);
  });

  it('should read education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    const education = await educationService.readOne(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
    expect(education.institution).toEqual(createTestEducation.institution);
  });

  it('should update education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    const education = await educationService.update(
      {
        id,
        degree: Degree.Associates,
        major: 'Electronic',
        institution: 'Cambridge',
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(education.institution).toEqual(createTestEducation.institution);
  });

  it('should delete education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    await educationService.delete(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
  });
});
