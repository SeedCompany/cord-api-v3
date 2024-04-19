import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  IdOf,
  InputException,
  loadManyIgnoreMissingThrowAny,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, ResourceLoader } from '../../core';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
import {
  LanguageListInput,
  LanguageService,
  SecuredLanguageList,
} from '../language';
import { Location, LocationLoader, LocationType } from '../location';
import { FinancialReportingType } from '../partnership/dto';
import {
  IProject,
  ProjectListInput,
  ProjectService,
  SecuredProjectList,
} from '../project';
import {
  CreatePartner,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  PartnerType,
  UpdatePartner,
} from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PartnerService {
  constructor(
    @Logger('partner:service') private readonly logger: ILogger,
    private readonly privileges: Privileges,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    @Inject(forwardRef(() => LanguageService))
    private readonly languageService: LanguageService & {},
    private readonly repo: PartnerRepository,
    private readonly resourceLoader: ResourceLoader,
  ) {}

  async create(input: CreatePartner, session: Session): Promise<Partner> {
    this.privileges.for(session, Partner).verifyCan('create');
    this.verifyFinancialReportingType(
      input.financialReportingTypes,
      input.types,
    );

    const partnerExists = await this.repo.partnerIdByOrg(input.organizationId);
    if (partnerExists) {
      throw new DuplicateException(
        'partner.organizationId',
        'Partner for organization already exists.',
      );
    }

    if (input.countries) {
      await this.verifyCountries(input.countries);
    }

    const id = await this.repo.create(input);

    this.logger.debug(`Partner created`, { id });
    return await this.readOne(id, session);
  }

  async readOnePartnerByOrgId(id: ID, session: Session): Promise<Partner> {
    this.logger.debug(`Read Partner by Org Id`, {
      id: id,
      userId: session.userId,
    });

    const partnerId = await this.repo.partnerIdByOrg(id);
    if (!partnerId)
      throw new NotFoundException('No Partner Exists for this Org Id');

    return await this.readOne(partnerId, session);
  }

  @HandleIdLookup(Partner)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Partner> {
    this.logger.debug(`Read Partner by Partner Id`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const partners = await this.repo.readMany(ids, session);
    return await Promise.all(partners.map((dto) => this.secure(dto, session)));
  }

  private async secure(dto: UnsecuredDto<Partner>, session: Session) {
    return this.privileges.for(session, Partner).secure(dto);
  }

  async update(input: UpdatePartner, session: Session): Promise<Partner> {
    const partner = await this.readOne(input.id, session);

    if (
      !this.validateFinancialReportingType(
        input.financialReportingTypes ?? partner.financialReportingTypes.value,
        input.types ?? partner.types.value,
      )
    ) {
      if (input.financialReportingTypes && input.types) {
        throw new InputException(
          'Financial reporting type can only be applied to managing partners',
          'partnership.financialReportingType',
        );
      }
      input = {
        ...input,
        financialReportingTypes: [],
      };
    }

    const changes = this.repo.getActualChanges(partner, input);
    this.privileges.for(session, Partner, partner).verifyChanges(changes);

    if (changes.countries) {
      await this.verifyCountries(changes.countries);
    }

    await this.repo.update(partner, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, Partner, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception: any) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted partner with id`, { id });
  }

  async list(
    input: PartnerListInput,
    session: Session,
  ): Promise<PartnerListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }

  async listProjects(
    partner: Partner,
    input: ProjectListInput,
    session: Session,
  ): Promise<SecuredProjectList> {
    const projectListOutput = await this.projectService.list(
      { ...input, filter: { ...input.filter, partnerId: partner.id } },
      session,
    );

    return {
      ...projectListOutput,
      canRead: true,
      canCreate: this.privileges.for(session, IProject).can('create'),
    };
  }

  async listLanguages(
    partner: Partner,
    input: LanguageListInput,
    session: Session,
  ): Promise<SecuredLanguageList> {
    const languageListOutput = await this.languageService.list(
      { ...input, filter: { ...input.filter, partnerId: partner.id } },
      session,
    );
    return {
      ...languageListOutput,
      canRead: true,
      // non-owned list
      canCreate: false,
    };
  }

  protected verifyFinancialReportingType(
    financialReportingTypes: FinancialReportingType[] | undefined,
    types: PartnerType[] | undefined,
  ) {
    if (!this.validateFinancialReportingType(financialReportingTypes, types)) {
      throw new InputException(
        'Financial reporting type can only be applied to managing partners',
        'partnership.financialReportingType',
      );
    }
  }

  protected validateFinancialReportingType(
    financialReportingTypes: readonly FinancialReportingType[] | undefined,
    types: readonly PartnerType[] | undefined,
  ) {
    return financialReportingTypes?.length &&
      !types?.includes(PartnerType.Managing)
      ? false
      : true;
  }

  private async verifyCountries(ids: ReadonlyArray<IdOf<Location>>) {
    const loader = await this.resourceLoader.getLoader(LocationLoader);
    const locations = await loadManyIgnoreMissingThrowAny(loader, ids);
    const invalidIds = locations.flatMap((location) =>
      location.type.value !== 'Country' ? location.id : [],
    );
    if (invalidIds.length === 0) {
      return;
    }
    const ex = new LocationTypeException([LocationType.Country], invalidIds);
    throw ex.withField('partner.countries');
  }
}

class LocationTypeException extends InputException {
  constructor(
    readonly allowedTypes: readonly LocationType[],
    readonly invalidIds: ID[],
  ) {
    super('Given locations do not match the expected type');
  }
}
