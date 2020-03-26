import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { Language } from './dto';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let languageService: LanguageService;
  const id = generate();
  const createTestLanguage: Partial<Language> = {
    id,
    name: {
      value: 'new-language',
      canRead: true,
      canEdit: true,
    },
    displayName: {
      value: 'new-displaylanguage',
      canRead: true,
      canEdit: true,
    },
    beginFiscalYear: {
      value: 2020,
      canRead: true,
      canEdit: true,
    },
    ethnologueName: {
      value: 'new-ethnologuename',
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

  const updateTestLanguage: Partial<Language> = {
    id,
    name: {
      value: 'updated-language',
      canRead: true,
      canEdit: true,
    },
    displayName: {
      value: 'updated-displaylanguage',
      canRead: true,
      canEdit: true,
    },
    beginFiscalYear: {
      value: 2020,
      canRead: true,
      canEdit: true,
    },
    ethnologueName: {
      value: 'uodated-ethnologuename',
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
    updateProperties: () => updateTestLanguage,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => createTestLanguage,
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
        name: 'create-language',
        displayName: 'create-displaylanguage',
        beginFiscalYear: 2020,
        ethnologueName: 'create-ethnologuename',
        ethnologuePopulation: 999,
        organizationPopulation: 9999,
        rodNumber: 321,
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(language.name).toEqual(createTestLanguage.name);
  });

  it('should read language node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    languageService.readOne = jest.fn().mockReturnValue(createTestLanguage);
    const language = await languageService.readOne(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
    console.log(language);
    expect(language.id).toEqual(createTestLanguage.id);
  });

  it.skip('should update language node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    languageService.readOne = jest.fn().mockReturnValue(createTestLanguage);

    const language = await languageService.update(
      {
        id: '12345',
        name: 'update-language',
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
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(language.name).toEqual(updateTestLanguage.name);
  });

  it('should delete language node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    languageService.readOne = jest.fn().mockReturnValue(createTestLanguage);

    await languageService.delete(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
  });
});
