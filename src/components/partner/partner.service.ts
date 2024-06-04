import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  loadManyIgnoreMissingThrowAny,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ResourceLoader } from '~/core';
import { Privileges } from '../authorization';
import { EngagementService } from '../engagement';
import { EngagementListInput } from '../engagement/dto';
import { LanguageService } from '../language';
import { LanguageListInput, SecuredLanguageList } from '../language/dto';
import { LocationLoader } from '../location';
import { Location, LocationType } from '../location/dto';
import { FinancialReportingType } from '../partnership/dto';
import { ProjectService } from '../project';
import { IProject, ProjectListInput, SecuredProjectList } from '../project/dto';
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
    private readonly privileges: Privileges,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    @Inject(forwardRef(() => EngagementService))
    private readonly engagementService: EngagementService & {},
    @Inject(forwardRef(() => LanguageService))
    private readonly languageService: LanguageService & {},
    private readonly repo: PartnerRepository,
    private readonly resourceLoader: ResourceLoader,
  ) {}

  async create(input: CreatePartner, session: Session): Promise<Partner> {
    this.verifyFinancialReportingType(
      input.financialReportingTypes,
      input.types,
    );

    if (input.countries) {
      await this.verifyCountries(input.countries);
    }

    const created = await this.repo.create(input, session);

    this.privileges.for(session, Partner, created).verifyCan('create');

    return this.secure(created, session);
  }

  async readOnePartnerByOrgId(id: ID, session: Session): Promise<Partner> {
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
    const result = await this.repo.readOne(id, session);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const partners = await this.repo.readMany(ids, session);
    return partners.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<Partner>, session: Session) {
    return this.privileges.for(session, Partner).secure(dto);
  }

  async update(input: UpdatePartner, session: Session): Promise<Partner> {
    const partner = await this.repo.readOne(input.id, session);

    if (
      !this.validateFinancialReportingType(
        input.financialReportingTypes ?? partner.financialReportingTypes,
        input.types ?? partner.types,
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

    const updated = await this.repo.update(
      {
        id: partner.id,
        ...changes,
      },
      session,
    );

    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, Partner, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception: any) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: PartnerListInput,
    session: Session,
  ): Promise<PartnerListOutput> {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
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
  async listEngagements(
    partner: Partner,
    input: EngagementListInput,
    session: Session,
  ) {
    return await this.engagementService.list(
      {
        ...input,
        filter: { ...input.filter, partnerId: partner.id },
      },
      session,
    );
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

  private async verifyCountries(ids: ReadonlyArray<ID<Location>>) {
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
