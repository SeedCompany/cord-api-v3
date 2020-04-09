import { Test } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  ISession,
  SecuredBoolean,
  SecuredDate,
  SecuredDateTime,
} from '../../common';
import { CoreModule, LoggerModule } from '../../core';
import { AuthModule, AuthService } from '../auth';
import { CeremonyService, SecuredCeremony } from '../ceremony';
import { LanguageService, SecuredLanguage } from '../language';
import { LocationService, SecuredCountry } from '../location';
import { OrganizationModule, OrganizationService } from '../organization';
import {
  ProductMethodology,
  ProductService,
  SecuredMethodologies,
} from '../product';
import {
  EducationModule,
  EducationService,
  SecuredUser,
  UnavailabilityModule,
  UnavailabilityService,
  UserModule,
} from '../user';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  EngagementStatus,
  InternPosition,
  InternshipEngagement,
  LanguageEngagement,
  SecuredInternPosition,
} from './dto';
import { EngagementService } from './engagement.service';
/* eslint-disable @typescript-eslint/consistent-type-assertions */
describe('EngamgemetService', () => {
  let engagementService: EngagementService;
  const id = generate();

  const defaultEngagementItems: Partial<Engagement> = {
    status: EngagementStatus.Active,
    ceremony: {} as SecuredCeremony,
    completeDate: {} as SecuredDate,
    disbursementCompleteDate: {} as SecuredDate,
    communicationsCompleteDate: {} as SecuredDate,
    startDate: {} as SecuredDate,
    endDate: {} as SecuredDate,
    initialEndDate: {} as SecuredDate,
    lastSuspendedAt: {} as SecuredDateTime,
    lastReactivatedAt: {} as SecuredDateTime,
    statusModifiedAt: {} as SecuredDateTime,
    modifiedAt: DateTime.local(),
  };

  const createLanguageEngagement: Partial<LanguageEngagement> = {
    id,
    createdAt: DateTime.local(),
    language: {} as SecuredLanguage,
    firstScripture: {} as SecuredBoolean,
    lukePartnership: {} as SecuredBoolean,
    sentPrintingDate: {} as SecuredDate,
    ...defaultEngagementItems,
  };

  const createInternshipEngagement: Partial<InternshipEngagement> = {
    id,
    createdAt: DateTime.local(),
    position: {} as SecuredInternPosition,
    intern: {} as SecuredUser,
    mentor: {} as SecuredUser,
    countryOfOrigin: {} as SecuredCountry,
    methodologies: {} as SecuredMethodologies,
    ...defaultEngagementItems,
  };

  const updateLanguageEngagement: Partial<LanguageEngagement> = {
    id,
    createdAt: DateTime.local(),
    language: {} as SecuredLanguage,
    firstScripture: {
      value: true,
      canRead: true,
      canEdit: true,
    },
    lukePartnership: {
      value: true,
      canRead: true,
      canEdit: true,
    },
    sentPrintingDate: {} as SecuredDate,
  };

  const updateInternshipEngagement: Partial<InternshipEngagement> = {
    id,
    createdAt: DateTime.local(),
    position: {
      value: InternPosition.AdministrativeSupportSpecialist,
      canRead: true,
      canEdit: true,
    },
    intern: {} as SecuredUser,
    mentor: {
      value: {
        id,
        createdAt: DateTime.local(),
        bio: {
          value: 'update-bio',
          canRead: true,
          canEdit: true,
        },
        email: {
          value: 'update-email@gmail.com',
          canRead: true,
          canEdit: true,
        },
        displayFirstName: {
          value: 'update-displayFirstName',
          canRead: true,
          canEdit: true,
        },
        displayLastName: {
          value: 'update-displayLastName',
          canRead: true,
          canEdit: true,
        },
        phone: {
          value: 'update-phone',
          canRead: true,
          canEdit: true,
        },
        realFirstName: {
          value: 'update-realFirstName',
          canRead: true,
          canEdit: true,
        },
        realLastName: {
          value: 'update-realLastName',
          canRead: true,
          canEdit: true,
        },
        timezone: {
          value: DateTime.local().toISOTime(),
          canRead: true,
          canEdit: true,
        },
      },
      canRead: true,
      canEdit: true,
    },
    countryOfOrigin: {} as SecuredCountry,
    methodologies: {
      value: [ProductMethodology.Film],
      canRead: true,
      canEdit: true,
    },
    ...defaultEngagementItems,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
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
        EngagementService,
        CeremonyService,
        LanguageService,
        LocationService,
        ProductService,
        EducationService,
        OrganizationService,
        UnavailabilityService,
        AuthService,
      ],
    }).compile();

    engagementService = module.get<EngagementService>(EngagementService);
  });

  it('should be defined', () => {
    expect(engagementService).toBeDefined();
  });

  it('should create a languageEngagement', async () => {
    jest
      .spyOn(engagementService, 'createLanguageEngagement')
      .mockImplementation(() =>
        Promise.resolve(createLanguageEngagement as LanguageEngagement)
      );
    const languageEngagement = await engagementService.createLanguageEngagement(
      {} as CreateLanguageEngagement,
      {} as ISession
    );
    expect(languageEngagement).toMatchObject(createLanguageEngagement);
  });

  it('should create an internshipEngagement', async () => {
    jest
      .spyOn(engagementService, 'createInternshipEngagement')
      .mockImplementation(() =>
        Promise.resolve(createInternshipEngagement as InternshipEngagement)
      );
    const internshipEngagement = await engagementService.createInternshipEngagement(
      {} as CreateInternshipEngagement,
      {} as ISession
    );
    expect(internshipEngagement).toMatchObject(createInternshipEngagement);
  });

  it('should read an Engagement', async () => {
    const createEngagement:
      | LanguageEngagement
      | InternshipEngagement = {} as Engagement;
    jest
      .spyOn(engagementService, 'readOne')
      .mockImplementation(() => Promise.resolve(createEngagement));

    const engagement = await engagementService.readOne(id, {} as ISession);

    expect(engagement).toMatchObject(createEngagement);
  });

  it('should update a languageEngagement', async () => {
    jest
      .spyOn(engagementService, 'updateLanguageEngagement')
      .mockImplementation(() =>
        Promise.resolve(updateLanguageEngagement as LanguageEngagement)
      );

    const languageEngagement = await engagementService.updateLanguageEngagement(
      {
        id,
        firstScripture: true,
        lukePartnership: true,
      },
      {} as ISession
    );

    expect(languageEngagement).toMatchObject(updateLanguageEngagement);
  });

  it('should update an internshipEngagement', async () => {
    jest
      .spyOn(engagementService, 'updateInternshipEngagement')
      .mockImplementation(() =>
        Promise.resolve(updateInternshipEngagement as InternshipEngagement)
      );

    const internshipEngagement = await engagementService.updateInternshipEngagement(
      {
        id,
        mentorId: id,
        methodologies: [ProductMethodology.Film],
        position: InternPosition.AdministrativeSupportSpecialist,
      },
      {} as ISession
    );

    expect(internshipEngagement).toMatchObject(updateInternshipEngagement);
  });

  it('should delete an Engagement', async () => {
    jest
      .spyOn(engagementService, 'delete')
      .mockImplementation(() => Promise.resolve());

    const languageEngagement = await engagementService.createLanguageEngagement(
      {} as CreateLanguageEngagement,
      {} as ISession
    );

    const internshipEngagement = await engagementService.createInternshipEngagement(
      {} as CreateInternshipEngagement,
      {} as ISession
    );

    await engagementService.delete(languageEngagement.id, {} as ISession);
    await engagementService.delete(internshipEngagement.id, {} as ISession);
  });
});
/* eslint-disable @typescript-eslint/consistent-type-assertions */
