import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { isNotFalsy, setHas, setOf } from '@seedcompany/common';
import {
  CalendarDate,
  ID,
  InputException,
  ObjectView,
  SecuredDate,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { Privileges } from '../authorization';
import { EngagementService, EngagementStatus } from '../engagement';
import {
  LocationListInput,
  LocationService,
  SecuredLocationList,
} from '../location';
import {
  IProject,
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

    const resultLanguage = await this.repo.create(input, session);

    return this.secure(resultLanguage, session);
  }

  @HandleIdLookup(Language)
  async readOne(
    langId: ID,
    session: Session,
    view?: ObjectView,
  ): Promise<Language> {
    const dto = await this.repo.readOne(langId, session, view);
    return this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const languages = await this.repo.readMany(ids, session, view);
    return languages.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<Language>, session: Session) {
    const ethnologue = this.ethnologueLanguageService.secure(
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

    const language = await this.repo.readOne(input.id, session, view);
    const changes = this.repo.getActualChanges(language, input);
    this.privileges.for(session, Language, language).verifyChanges(changes);

    const { ethnologue, ...simpleChanges } = changes;

    if (ethnologue) {
      await this.ethnologueLanguageService.update(
        language.ethnologue.id,
        ethnologue,
        language.sensitivity,
        session,
      );
    }

    const updated = await this.repo.update(
      { id: language.id, ...simpleChanges },
      session,
      view?.changeset,
    );

    return this.secure(updated, session);
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

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
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
    const projectListOutput = await this.projectService.list(
      { ...input, filter: { ...input.filter, languageId: language.id } },
      session,
    );

    return {
      ...projectListOutput,
      canRead: true,
      canCreate: this.privileges.for(session, IProject).can('create'),
    };
  }

  async sponsorStartDate(
    language: Language,
    session: Session,
  ): Promise<SecuredDate> {
    const engagementIds = await this.repo.getEngagementIdsForLanguage(language);

    try {
      const engagements = await Promise.all(
        engagementIds.map((engagementId) =>
          this.engagementService.readOne(engagementId, session),
        ),
      );
      const statusesToIgnore = setOf([
        EngagementStatus.InDevelopment,
        EngagementStatus.DidNotDevelop,
        EngagementStatus.Unapproved,
        EngagementStatus.Rejected,
      ]);
      const dates = engagements
        .filter(
          (engagement) =>
            engagement.status.value &&
            !setHas(statusesToIgnore, engagement.status.value),
        )
        .map((engagement) => engagement.startDate.value)
        .filter(isNotFalsy);

      const canRead = engagements.every(
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

  async addLocation(languageId: ID, locationId: ID): Promise<void> {
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

  async removeLocation(languageId: ID, locationId: ID): Promise<void> {
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
    const engagement = await this.repo.hasFirstScriptureEngagement(id);
    if (engagement) {
      throw new InputException(
        'hasExternalFirstScripture can be set to true if the language has no engagements that have firstScripture=true',
        'language.hasExternalFirstScripture',
      );
    }
  }
}
