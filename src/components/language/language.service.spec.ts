import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { Language } from './dto';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let languageService: LanguageService;

  const createTestLanguage: Partial<Language> = {
    id: generate(),
    name: {
      value: 'test-language',
      canRead: true,
      canEdit: true,
    },
    displayName: {
      value: 'test-displaylanguage',
      canRead: true,
      canEdit: true,
    },
    beginFiscalYear: {
      value: 2020,
      canRead: true,
      canEdit: true,
    },
    ethnologueName: {
      value: 'test-ethnologuename',
      canRead: true,
      canEdit: true,
    },
    ethnologuePopulation: {
      value: 909090,
      canRead: true,
      canEdit: true,
    },
    organizationPopulation: {
      value: 9999999,
      canRead: true,
      canEdit: true,
    },
    rodNumber: {
      value: 321,
      canRead: true,
      canEdit: true,
    },
  };

  const mockDbService = {
    createNode: () => createTestLanguage,
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => ({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule, LanguageService],
      providers: [
        LanguageService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    languageService = module.get<LanguageService>(LanguageService);
  });

  it('should be defined', () => {
    expect(LanguageService).toBeDefined();
  });

  it('should create language node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    languageService.readOne = jest.fn().mockReturnValue(createTestLanguage);

    const language = await languageService.create(
      {
        name: 'test-language',
        displayName: 'test-displaylanguage',
        beginFiscalYear: 2020,
        ethnologueName: 'test-ethnologuename',
        ethnologuePopulation: 999,
        organizationPopulation: 9999,
        rodNumber: 321,
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: 'abcd',
        issuedAt: DateTime.local(),
      }
    );
    expect(language.name).toEqual(createTestLanguage.name);
  });
});
