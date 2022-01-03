import { Injectable } from '@nestjs/common';
import { getFromContainer } from 'class-validator';
import got from 'got/dist/source';
import { compact } from 'lodash';
import {
  CalendarDate,
  DuplicateException,
  getFromCordTables,
  ID,
  InputException,
  NotFoundException,
  ObjectView,
  PaginatedListType,
  SecuredDate,
  Sensitivity,
  ServerException,
  Session,
  simpleSwitch,
  transformEthnologueDtoToPayload,
  transformEthnologuePayloadToDto,
  transformLanguageDtoToPayload,
  transformLanguagePayloadToDto,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, UniquenessError } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import { EngagementService, EngagementStatus } from '../engagement';
import {
  LocationListInput,
  LocationService,
  SecuredLocationList,
} from '../location';
import {
  Project,
  ProjectListInput,
  ProjectService,
  SecuredProjectList,
} from '../project';
import {
  CreateEthnologueLanguage,
  CreateLanguage,
  EthnologueLanguage,
  Language,
  LanguageListInput,
  LanguageListOutput,
  TablesLanguage,
  TablesLanguages,
  TablesReadEthnologue,
  TablesReadLanguage,
  UpdateLanguage,
} from './dto';
import { EthnologueLanguageService } from './ethnologue-language';
import { LanguageRepository } from './language.repository';

@Injectable()
export class LanguageService {
  constructor(
    private readonly ethnologueLanguageService: EthnologueLanguageService,
    private readonly locationService: LocationService,
    private readonly projectService: ProjectService,
    private readonly engagementService: EngagementService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: LanguageRepository,
    @Logger('language:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateLanguage, session: Session): Promise<Language> {
    await this.authorizationService.checkPower(Powers.CreateLanguage, session);

    await this.authorizationService.checkPower(
      Powers.CreateEthnologueLanguage,
      session
    );

    try {
      const ethnologueId = (
        await this.writeEthnologue(
          input.ethnologue,
          input.sensitivity ?? Sensitivity.High,
          session
        )
      ).id;

      const result = await this.writeLanguage(input, session, ethnologueId);

      return result;
    } catch (e) {
      if (e instanceof UniquenessError) {
        const prop =
          simpleSwitch(e.label, {
            LanguageName: 'name',
            LanguageDisplayName: 'displayName',
            RegistryOfDialectsCode: `registryOfDialectsCode`,
          }) ?? e.label;
        throw new DuplicateException(
          `language.${prop}`,
          `${prop} with value ${e.value} already exists`,
          e
        );
      }
      this.logger.error(`Could not create`, { ...input, exception: e });
      throw new ServerException('Could not create language', e);
    }
  }

  async writeEthnologue(
    eth: CreateEthnologueLanguage,
    sensitivity: Sensitivity,
    session: Session
  ) {
    const response = await getFromCordTables('sc-ethnologue/create-read', {
      ethnologue: { ...transformEthnologueDtoToPayload(eth, sensitivity) },
    });
    const iLanguage: TablesReadEthnologue = JSON.parse(response.body);

    const dto: UnsecuredDto<EthnologueLanguage> =
      transformEthnologuePayloadToDto(iLanguage.ethnologue);
    return await this.ethnologueLanguageService.secure(
      dto,
      iLanguage.ethnologue.sensitivity,
      session
    );
  }

  async writeLanguage(
    language: CreateLanguage,
    session: Session,
    ethnologueId: ID
  ) {
    const response = await getFromCordTables('sc-languages/create-read', {
      language: { ...transformLanguageDtoToPayload(language, ethnologueId) },
    });
    const iLanguage: TablesReadLanguage = JSON.parse(response.body);

    const dto: UnsecuredDto<Language> = transformLanguagePayloadToDto(
      iLanguage.language
    );
    return await this.secure(dto, session);
  }

  @HandleIdLookup(Language)
  async readOne(
    langId: ID,
    session: Session,
    view?: ObjectView
  ): Promise<Language> {
    //const dto = await this.repo.readOne(langId, session, view);
    // return await this.secure(dto, session);
    return await this.getLanguage(langId, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const languages = await this.repo.readMany(ids, session, view);
    // return await Promise.all(languages.map((dto) => this.secure(dto, session)));
    return await Promise.all(
      ids.map(async (id) => {
        return await this.getLanguage(id, session);
      })
    );
  }
  async getLanguage(langId: ID, session: Session): Promise<Language> {
    const response = await getFromCordTables('sc-languages/read', {
      id: langId,
    });
    const language = response.body;
    // console.log(response)
    // console.log("\n\n\n\n\n")
    // console.log(language)

    const iLanguage: TablesReadLanguage = JSON.parse(language);

    const dto: UnsecuredDto<Language> = transformLanguagePayloadToDto(
      iLanguage.language
    );
    return await this.secure(dto, session);
  }

  private async secure(
    dto: UnsecuredDto<Language>,
    session: Session
  ): Promise<Language> {
    const securedProps = await this.authorizationService.secureProperties(
      Language,
      dto,
      session,
      undefined,
      dto.effectiveSensitivity
    );

    const ethnologue = await this.ethnologueLanguageService.secure(
      dto.ethnologue,
      dto.sensitivity,
      session
    );

    return {
      ...dto,
      ...securedProps,
      ethnologue,
      tags: {
        ...securedProps.tags,
        value: securedProps.tags.value ?? [],
      },
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
      presetInventory: {
        ...securedProps.presetInventory,
        canEdit: false, // calculated
      },
    };
  }

  async update(
    input: UpdateLanguage,
    session: Session,
    view?: ObjectView
  ): Promise<Language> {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }

    const object = await this.readOne(input.id, session, view);
    const changes = this.repo.getActualChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      Language,
      object,
      changes
    );

    const { ethnologue, ...simpleChanges } = changes;

    if (ethnologue) {
      await this.ethnologueLanguageService.update(
        object.ethnologue.id,
        ethnologue,
        object.sensitivity,
        session
      );
    }

    await this.repo.updateProperties(object, simpleChanges, view?.changeset);

    return await this.readOne(input.id, session, view);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find language', 'language.id');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Language'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: LanguageListInput,
    session: Session
  ): Promise<LanguageListOutput> {
    // const limited = (await this.authorizationService.canList(Language, session))
    //   ? undefined
    //   : await this.authorizationService.getListRoleSensitivityMapping(Language);
    // const results = await this.repo.list(input, session, limited);
    // return await mapListResults(results, (dto) => this.secure(dto, session));
    return await this.getLanguages(session, input);
  }

  async getLanguages(
    session: Session,
    input: LanguageListInput
  ): Promise<LanguageListOutput> {
    const response = await getFromCordTables('sc-languages/list', {
      sort: input.sort,
      order: input.order,
      page: input.page,
      resultsPerPage: input.count,
      filter: { ...input.filter },
    });
    const languages = response.body;
    const iLanguages: TablesLanguages = JSON.parse(languages);

    const langArray: Array<UnsecuredDto<Language>> = iLanguages.languages.map(
      (lang) => {
        return transformLanguagePayloadToDto(lang);
      }
    );

    const totalLoaded = input.count * (input.page - 1) + langArray.length;
    const langList: PaginatedListType<UnsecuredDto<Language>> = {
      items: langArray,
      total: totalLoaded, // ui is wanting the total loaded, not total for this 'load' that has been loaded.
      hasMore: totalLoaded < iLanguages.size,
    };

    return await mapListResults(langList, (dto) => this.secure(dto, session));
  }

  async listLocations(
    dto: Language,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      Language,
      dto,
      'locations',
      input,
      session
    );
  }

  async listProjects(
    language: Language,
    input: ProjectListInput,
    session: Session
  ): Promise<SecuredProjectList> {
    const { page, count } = {
      ...ProjectListInput.defaultVal,
      ...input,
    };

    const result: {
      items: Project[];
      hasMore: boolean;
      total: number;
    } = { items: [], hasMore: false, total: 0 };

    let readProject = await this.repo.listProjects(language);

    this.logger.debug(`list projects results`, { total: readProject.length });

    result.total = readProject.length;
    result.hasMore = count * page < result.total ?? true;

    readProject = readProject.slice().splice((page - 1) * count, count);

    result.items = await Promise.all(
      readProject.map(
        async (project) =>
          await this.projectService.readOne(project.id, session)
      )
    );

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
      //TODO: use the upcoming Roles service to determine permissions.
      canCreate: true,
      canRead: true,
    };
  }

  async sponsorStartDate(
    language: Language,
    session: Session
  ): Promise<SecuredDate> {
    const result = await this.repo.sponsorStartDate(language);

    if (!result) {
      throw new ServerException('Error fetching sponsorStartDate');
    }

    try {
      const engagments = await Promise.all(
        result.engagementIds.map((engagementId) =>
          this.engagementService.readOne(engagementId, session)
        )
      );
      const dates = compact(
        engagments
          .filter(
            (engagement) =>
              engagement.status.value &&
              ![
                EngagementStatus.InDevelopment,
                EngagementStatus.DidNotDevelop,
                EngagementStatus.Unapproved,
                EngagementStatus.Rejected,
              ].includes(engagement.status.value)
          )
          .map((engagement) => engagement.startDate.value)
      );

      const canRead = engagments.every(
        (engagement) => engagement.startDate.canRead
      );

      const value =
        dates.length && canRead ? CalendarDate.min(...dates) : undefined;

      return {
        canRead,
        canEdit: false,
        value,
      };
    } catch {
      //if engagement readOne returns a not found exception, then don't have read permissions on the engagement
      return {
        canRead: false,
        canEdit: false,
        value: undefined,
      };
    }
  }

  async addLocation(
    languageId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'Language',
        languageId,
        'locations',
        locationId
      );
    } catch (e) {
      throw new ServerException('Could not add location to language', e);
    }
  }

  async removeLocation(
    languageId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'Language',
        languageId,
        'locations',
        locationId
      );
    } catch (e) {
      throw new ServerException('Could not remove location from language', e);
    }
  }

  /**
   * Check if the language has no engagements that have firstScripture=true.
   */
  protected async verifyExternalFirstScripture(id: ID) {
    const engagement = await this.repo.verifyExternalFirstScripture(id);
    if (engagement) {
      throw new InputException(
        'hasExternalFirstScripture can be set to true if the language has no engagements that have firstScripture=true',
        'language.hasExternalFirstScripture'
      );
    }
  }
}
