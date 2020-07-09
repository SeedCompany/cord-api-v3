import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationModule } from '../authentication/authentication.module';
import { OrganizationModule } from '../organization/organization.module';
import { UserService } from '../user';
import { UserModule } from '../user/user.module';
import {
  Partnership,
  PartnershipAgreementStatus,
  PartnershipType,
  UpdatePartnership,
} from './dto';
import { PartnershipModule } from './partnership.module';
import { PartnershipService } from './partnership.service';

const organizationId = 'ASDF23FQ';
const projectId = generate();
const id = generate();
const createTestPartnership: Partial<Partnership> = {
  id,
  createdAt: DateTime.local(),
  agreementStatus: {
    value: PartnershipAgreementStatus.Signed,
    canRead: true,
    canEdit: true,
  },
  mouStatus: {
    value: PartnershipAgreementStatus.Signed,
    canRead: true,
    canEdit: true,
  },
  mouStart: {
    value: DateTime.local(),
    canRead: true,
    canEdit: true,
  },
  mouEnd: {
    value: DateTime.local(),
    canRead: true,
    canEdit: true,
  },
  types: {
    value: [PartnershipType.Technical],
    canRead: true,
    canEdit: true,
  },
};

const mockDbService = {
  createNode: () => createTestPartnership,
  updateProperties: () => createTestPartnership,
  deleteNode: () => ({}),
  query: () => ({
    raw: () => ({
      run: () => ({}),
    }),
  }),
  readProperties: () => createTestPartnership,
};

const mockSession = {
  token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUyNzMyNjk5MDZ9.L-GqiZ3r05gnf6qv4dXSqSn83b2ItMIF_Jti1Ic_7aM',
  userId: 'abcd',
  owningOrgId: '123456',
  issuedAt: DateTime.local(),
};

describe('partnership service', () => {
  let partnershipService: PartnershipService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forTest(),
        UserModule,
        CoreModule,
        PartnershipModule,
        OrganizationModule,
        AuthenticationModule,
      ],
      providers: [
        UserService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
        PartnershipService,
      ],
    }).compile();
    partnershipService = module.get<PartnershipService>(PartnershipService);
  });

  it('should be defined', () => {
    expect(partnershipService).toBeDefined();
  });

  it('should create partnership', async () => {
    jest
      .spyOn(partnershipService, 'readOne')
      .mockImplementation(() =>
        Promise.resolve(createTestPartnership as Partnership)
      );

    const partnership = await partnershipService.create(
      {
        organizationId,
        agreementStatus: PartnershipAgreementStatus.NotAttached,
        mouStatus: PartnershipAgreementStatus.NotAttached,
        types: [PartnershipType.Technical],
        mouStartOverride: DateTime.local(),
        mouEndOverride: DateTime.local(),
        projectId,
      },
      mockSession as ISession
    );
    expect(partnership.agreementStatus).toEqual(
      createTestPartnership.agreementStatus
    );
    expect(partnership.mouStatus).toEqual(createTestPartnership.mouStatus);
    expect(partnership.mouStart).toEqual(createTestPartnership.mouStart);
    expect(partnership.mouEnd).toEqual(createTestPartnership.mouEnd);
    expect(partnership.types).toEqual(createTestPartnership.types);
  });

  it('should read partnership', async () => {
    jest
      .spyOn(partnershipService, 'readOne')
      .mockImplementation(() =>
        Promise.resolve(createTestPartnership as Partnership)
      );

    const partnership = await partnershipService.readOne(id, mockSession);

    expect(partnership.id).toEqual(createTestPartnership.id);
    expect(partnership.agreementStatus).toEqual(
      createTestPartnership.agreementStatus
    );
    expect(partnership.mouStatus).toEqual(createTestPartnership.mouStatus);
    expect(partnership.mouStart).toEqual(createTestPartnership.mouStart);
    expect(partnership.mouEnd).toEqual(createTestPartnership.mouEnd);
    expect(partnership.types).toEqual(createTestPartnership.types);
  });

  it('should update partnership node', async () => {
    jest
      .spyOn(partnershipService, 'readOne')
      .mockImplementation(() =>
        Promise.resolve(createTestPartnership as Partnership)
      );

    const partnership = await partnershipService.update(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as UpdatePartnership,
      mockSession as ISession
    );

    expect(partnership.agreementStatus).toEqual(
      createTestPartnership.agreementStatus
    );
    expect(partnership.mouStatus).toEqual(createTestPartnership.mouStatus);
    expect(partnership.mouStart).toEqual(createTestPartnership.mouStart);
    expect(partnership.mouEnd).toEqual(createTestPartnership.mouEnd);
    expect(partnership.types).toEqual(createTestPartnership.types);
  });

  it('should delete a user', async () => {
    jest
      .spyOn(partnershipService, 'readOne')
      .mockImplementation(() =>
        Promise.resolve(createTestPartnership as Partnership)
      );

    await partnershipService.delete(id, mockSession as ISession);
  });
});
