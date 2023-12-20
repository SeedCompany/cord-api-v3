import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { isNotFalsy, setHas, setOf, simpleSwitch } from '@seedcompany/common';
import {
  CalendarDate,
  DuplicateException,
  ID,
  InputException,
  ObjectView,
  SecuredDate,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, UniquenessError } from '../../core';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
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
  CreateLanguage,
  Language,
  LanguageListInput,
  LanguageListOutput,
  UpdateLanguage,
} from './dto';
import { EthnologueLanguageService } from './ethnologue-language';
import { LanguageRepository } from './language.repository';

@Injectable()
export class LanguageService {
  constructor(
    private readonly ethnologueLanguageService: EthnologueLanguageService,
    private readonly locationService: LocationService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    @Inject(forwardRef(() => EngagementService))
    private readonly engagementService: EngagementService & {},
    private readonly privileges: Privileges,
    private readonly repo: LanguageRepository,
    @Logger('language:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreateLanguage, session: Session): Promise<Language> {
    this.privileges.for(session, Language).verifyCan('create');

    try {
      const ethnologueId = await this.ethnologueLanguageService.create(
        input?.ethnologue,
        session,
      );

      // create language and connect ethnologueLanguage to language
      const resultLanguage = await this.repo.create(
        input,
        ethnologueId,
        session,
      );

      if (!resultLanguage) {
        throw new ServerException('failed to create language');
      }

      const result = await this.readOne(resultLanguage.id, session);

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
          e,
        );
      }
      this.logger.error(`Could not create`, { ...input, exception: e });
      throw new ServerException('Could not create language', e);
    }
  }

  @HandleIdLookup(Language)
  async readOne(
    langId: ID,
    session: Session,
    view?: ObjectView,
  ): Promise<Language> {
    const dto = await this.repo.readOne(langId, session, view);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const languages = await this.repo.readMany(ids, session, view);
    return await Promise.all(languages.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: UnsecuredDto<Language>,
    session: Session,
  ): Promise<Language> {
    const ethnologue = await this.ethnologueLanguageService.secure(
      dto.ethnologue,
      dto.sensitivity,
      session,
    );

    return {
      ...this.privileges.for(session, Language).secure(dto),
      ethnologue,
    };
  }

  async update(
    input: UpdateLanguage,
    session: Session,
    view?: ObjectView,
  ): Promise<Language> {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }

    const object = await this.readOne(input.id, session, view);
    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(session, Language, object).verifyChanges(changes);

    const { ethnologue, ...simpleChanges } = changes;

    if (ethnologue) {
      await this.ethnologueLanguageService.update(
        object.ethnologue.id,
        ethnologue,
        object.sensitivity,
        session,
      );
    }

    await this.repo.update(object, simpleChanges, view?.changeset);

    return await this.readOne(input.id, session, view);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, Language, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: LanguageListInput,
    session: Session,
  ): Promise<LanguageListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }

  async listLocations(
    dto: Language,
    input: LocationListInput,
    session: Session,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(session, Language, dto).forEdge('locations'),
      dto,
      input,
    );
  }

  async listProjects(
    language: Language,
    input: ProjectListInput,
    session: Session,
  ): Promise<SecuredProjectList> {
    const { page, count } = ProjectListInput.defaultValue(
      ProjectListInput,
      input,
    );

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
          await this.projectService.readOne(project.id, session),
      ),
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
    session: Session,
  ): Promise<SecuredDate> {
    const result = await this.repo.sponsorStartDate(language);

    if (!result) {
      throw new ServerException('Error fetching sponsorStartDate');
    }

    try {
      const engagments = await Promise.all(
        result.engagementIds.map((engagementId) =>
          this.engagementService.readOne(engagementId, session),
        ),
      );
      const statusesToIgnore = setOf([
        EngagementStatus.InDevelopment,
        EngagementStatus.DidNotDevelop,
        EngagementStatus.Unapproved,
        EngagementStatus.Rejected,
      ]);
      const dates = engagments
        .filter(
          (engagement) =>
            engagement.status.value &&
            !setHas(statusesToIgnore, engagement.status.value),
        )
        .map((engagement) => engagement.startDate.value)
        .filter(isNotFalsy);

      const canRead = engagments.every(
        (engagement) => engagement.startDate.canRead,
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
    _session: Session,
  ): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'Language',
        languageId,
        'locations',
        locationId,
      );
    } catch (e) {
      throw new ServerException('Could not add location to language', e);
    }
  }

  async removeLocation(
    languageId: ID,
    locationId: ID,
    _session: Session,
  ): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'Language',
        languageId,
        'locations',
        locationId,
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
        'language.hasExternalFirstScripture',
      );
    }
  }
}
