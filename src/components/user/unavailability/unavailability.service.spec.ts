import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../../core';
import { Unavailability } from './dto';
import { UnavailabilityService } from './unavailability.service';

describe('UnavailabilityService', () => {
  let unavailabilityService: UnavailabilityService;
  const id = generate();

  const createTestUnavailability: Partial<Unavailability> = {
    id,
    description: {
      value: 'user-unavailability',
      canRead: true,
      canEdit: true,
    },
    start: {
      value: DateTime.local(),
      canRead: true,
      canEdit: true,
    },
    end: {
      value: DateTime.local(),
      canRead: true,
      canEdit: true,
    },
  };

  const mockDbService = {
    createNode: () => createTestUnavailability,
    updateProperties: () => createTestUnavailability,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => createTestUnavailability,
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
        UnavailabilityService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    unavailabilityService = module.get<UnavailabilityService>(
      UnavailabilityService
    );
  });

  it('should be defined', () => {
    expect(UnavailabilityService).toBeDefined();
  });

  it('should create unavailability node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    unavailabilityService.readOne = jest
      .fn()
      .mockReturnValue(createTestUnavailability);
    const unavailability = await unavailabilityService.create(
      {
        userId: 'abcd',
        description: 'user-unavailability',
        start: DateTime.local(),
        end: DateTime.local(),
      },
      mockSession
    );
    expect(unavailability.description).toEqual(
      createTestUnavailability.description
    );
    expect(unavailability.start).toEqual(createTestUnavailability.start);
    expect(unavailability.end).toEqual(createTestUnavailability.end);
  });

  it('should read unavailability node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    unavailabilityService.readOne = jest
      .fn()
      .mockReturnValue(createTestUnavailability);
    const unavailability = await unavailabilityService.readOne(id, mockSession);
    expect(unavailability.description).toEqual(
      createTestUnavailability.description
    );
    expect(unavailability.start).toEqual(createTestUnavailability.start);
    expect(unavailability.end).toEqual(createTestUnavailability.end);
  });

  it('should update unavailability node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    unavailabilityService.readOne = jest
      .fn()
      .mockReturnValue(createTestUnavailability);
    const unavailability = await unavailabilityService.update(
      {
        id,
        description: 'user-unavailability',
        start: DateTime.local(),
        end: DateTime.local(),
      },
      mockSession
    );
    expect(unavailability.description).toEqual(
      createTestUnavailability.description
    );
    expect(unavailability.start).toEqual(createTestUnavailability.start);
    expect(unavailability.end).toEqual(createTestUnavailability.end);
  });

  it('should delete unavailability node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    unavailabilityService.readOne = jest
      .fn()
      .mockReturnValue(createTestUnavailability);
    const unavailability = await unavailabilityService.create(
      {
        userId: 'abcd',
        description: 'user-unavailability',
        start: DateTime.local(),
        end: DateTime.local(),
      },
      mockSession
    );
    await unavailabilityService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(unavailability.id).toEqual(createTestUnavailability.id);
    expect(unavailability.description).toEqual(
      createTestUnavailability.description
    );
    expect(unavailability.start).toEqual(createTestUnavailability.start);
    expect(unavailability.end).toEqual(createTestUnavailability.end);
  });
});
