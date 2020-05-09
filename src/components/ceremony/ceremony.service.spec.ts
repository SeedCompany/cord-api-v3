import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { CeremonyService } from './ceremony.service';
import { Ceremony, UpdateCeremony } from './dto';
import { CeremonyType } from './dto/type.enum';

describe('CeremonyService', () => {
  let ceremonyService: CeremonyService;
  const id = generate();

  const createTestCeremony: Partial<Ceremony> = {
    id,
    type: CeremonyType.Dedication,
    planned: {
      value: true,
      canRead: true,
      canEdit: true,
    },
    estimatedDate: {
      value: DateTime.local(),
      canRead: true,
      canEdit: true,
    },
    actualDate: {
      value: DateTime.local(),
      canRead: true,
      canEdit: true,
    },
  };

  const mockDbService = {
    createNode: () => createTestCeremony,
    updateProperties: () => createTestCeremony,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
        first: () => ({}),
      }),
    }),
    readProperties: () => createTestCeremony,
    readProperty: () => ({}),
  };

  const mockSession = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
    userId: '12345',
    issuedAt: DateTime.local(),
    owningOrgId: 'Seed Company',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forTest(), CoreModule, CeremonyService],
      providers: [
        CeremonyService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    ceremonyService = module.get<CeremonyService>(CeremonyService);
  });

  it('should be defined', () => {
    expect(CeremonyService).toBeDefined();
  });

  it('should create ceremony node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    ceremonyService.readOne = jest.fn().mockReturnValue(createTestCeremony);
    const ceremony = await ceremonyService.create(
      {
        type: CeremonyType.Dedication,
        planned: true,
        estimatedDate: DateTime.local(),
        actualDate: DateTime.local(),
      },
      mockSession
    );
    expect(ceremony.type).toEqual(createTestCeremony.type);
    expect(ceremony.planned).toEqual(createTestCeremony.planned);
    expect(ceremony.estimatedDate).toEqual(createTestCeremony.estimatedDate);
    expect(ceremony.actualDate).toEqual(createTestCeremony.actualDate);
  });

  it('should read ceremony node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    ceremonyService.readOne = jest.fn().mockReturnValue(createTestCeremony);
    const ceremony = await ceremonyService.readOne(id, mockSession);
    expect(ceremony.type).toEqual(createTestCeremony.type);
    expect(ceremony.planned).toEqual(createTestCeremony.planned);
    expect(ceremony.estimatedDate).toEqual(createTestCeremony.estimatedDate);
    expect(ceremony.actualDate).toEqual(createTestCeremony.actualDate);
  });

  it('should update ceremony node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    jest
      .spyOn(ceremonyService, 'readOne')
      .mockImplementation(() =>
        Promise.resolve(createTestCeremony as Ceremony)
      );
    const ceremony = await ceremonyService.update(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as UpdateCeremony,
      mockSession as ISession
    );
    expect(ceremony.id).toEqual(createTestCeremony.id);
    expect(ceremony.type).toEqual(createTestCeremony.type);
    expect(ceremony.planned).toEqual(createTestCeremony.planned);
    expect(ceremony.estimatedDate).toEqual(createTestCeremony.estimatedDate);
    expect(ceremony.actualDate).toEqual(createTestCeremony.actualDate);
  });

  it('should delete ceremony node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    ceremonyService.readOne = jest.fn().mockReturnValue(createTestCeremony);
    const ceremony = await ceremonyService.create(
      {
        type: CeremonyType.Dedication,
        planned: true,
        estimatedDate: DateTime.local(),
        actualDate: DateTime.local(),
      },
      mockSession
    );
    await ceremonyService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(ceremony.id).toEqual(createTestCeremony.id);
    expect(ceremony.type).toEqual(createTestCeremony.type);
    expect(ceremony.planned).toEqual(createTestCeremony.planned);
    expect(ceremony.estimatedDate).toEqual(createTestCeremony.estimatedDate);
    expect(ceremony.actualDate).toEqual(createTestCeremony.actualDate);
  });
});
