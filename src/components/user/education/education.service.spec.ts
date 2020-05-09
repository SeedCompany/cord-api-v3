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

  const mockDbService = {
    createNode: () => createTestEducation,
    updateProperties: () => createTestEducation,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => createTestEducation,
  };

  const mockSession = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
    userId: '12345',
    issuedAt: DateTime.local(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forTest(), CoreModule],
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
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    const education = await educationService.create(
      {
        userId: 'abcd',
        degree: Degree.Associates,
        major: 'Electronic',
        institution: 'Cambridge',
      },
      mockSession
    );
    expect(education.degree).toEqual(createTestEducation.degree);
    expect(education.major).toEqual(createTestEducation.major);
    expect(education.institution).toEqual(createTestEducation.institution);
  });

  it('should read education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    const education = await educationService.readOne(id, mockSession);
    expect(education.degree).toEqual(createTestEducation.degree);
    expect(education.major).toEqual(createTestEducation.major);
    expect(education.institution).toEqual(createTestEducation.institution);
  });

  it('should update education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    const education = await educationService.update(
      {
        id,
        degree: Degree.Doctorate,
        major: 'Medicine',
        institution: 'Cambridge',
      },
      mockSession
    );
    expect(education.degree).toEqual(createTestEducation.degree);
    expect(education.major).toEqual(createTestEducation.major);
    expect(education.institution).toEqual(createTestEducation.institution);
  });

  it('should delete education node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    educationService.readOne = jest.fn().mockReturnValue(createTestEducation);
    const education = await educationService.create(
      {
        userId: 'abcd',
        degree: Degree.Associates,
        major: 'Electronic',
        institution: 'Cambridge',
      },
      mockSession
    );
    await educationService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(education.id).toEqual(createTestEducation.id);
    expect(education.degree).toEqual(createTestEducation.degree);
    expect(education.major).toEqual(createTestEducation.major);
    expect(education.institution).toEqual(createTestEducation.institution);
  });
});
