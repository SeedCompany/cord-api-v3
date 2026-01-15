import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { isNotFalsy, setHas, setOf } from '@seedcompany/common';
import {
  CalendarDate,
  type ID,
  InputException,
  NotFoundException,
  type ObjectView,
  type SecuredDate,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ILogger, Logger } from '~/core/logger';
import { HandleIdLookup, ResourceLoader } from '~/core/resources';
import { Privileges } from '../authorization';
import { EngagementLoader, EngagementService } from '../engagement';
import { type EngagementListInput, EngagementStatus } from '../engagement/dto';
import { LocationService } from '../location';
import {
  type LocationListInput,
  type SecuredLocationList,
} from '../location/dto';
import { ProjectService } from '../project';
import {
  IProject,
  type ProjectListInput,
  type SecuredProjectList,
} from '../project/dto';
import {
  type CreateLanguage,
  Language,
  type LanguageListInput,
  type LanguageListOutput,
  type UpdateLanguage,
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
    private readonly loaders: ResourceLoader,
    private readonly repo: LanguageRepository,
    @Logger('language:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreateLanguage): Promise<Language> {
    this.privileges.for(Language).verifyCan('create');

    const resultLanguage = await this.repo.create(input);

    return this.secure(resultLanguage);
  }

  @HandleIdLookup(Language)
  async readOne(
    langId: ID,

    view?: ObjectView,
  ): Promise<Language> {
    const dto = await this.repo.readOne(langId, view);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[], view?: ObjectView) {
    const languages = await this.repo.readMany(ids, view);
    return languages.map((dto) => this.secure(dto));
  }

  async readOneByEthId(ethnologueId: ID) {
    const dto = await this.repo.readOneByEth(ethnologueId);
    return this.secure(dto);
  }

  private secure(dto: UnsecuredDto<Language>) {
    const ethnologue = this.ethnologueLanguageService.secure(
      dto.ethnologue,
      dto.sensitivity,
    );

    return {
      ...this.privileges.for(Language).secure(dto),
      ethnologue,
    };
  }

  async update(input: UpdateLanguage, view?: ObjectView): Promise<Language> {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }
    const { registryOfDialectsCode, changeset, ...props } = input;

    const language = await this.repo.readOne(input.id, view);
    const changes = this.repo.getActualChanges(language, {
      ...props,
      registryOfLanguageVarietiesCode:
        props.registryOfLanguageVarietiesCode ?? registryOfDialectsCode,
    });
    this.privileges.for(Language, language).verifyChanges(changes);

    const { ethnologue, ...simpleChanges } = changes;

    if (ethnologue) {
      await this.ethnologueLanguageService.update(
        language.ethnologue.id,
        ethnologue,
        language.sensitivity,
      );
    }

    const updated = await this.repo.update(
      { id: language.id, ...simpleChanges },
      view?.changeset,
    );

    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(Language, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: LanguageListInput): Promise<LanguageListOutput> {
    const results = await this.repo.list(input);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  async listLocations(
    dto: Language,
    input: LocationListInput,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(Language, dto).forEdge('locations'),
      dto,
      input,
    );
  }

  async listProjects(
    language: Language,
    input: ProjectListInput,
  ): Promise<SecuredProjectList> {
    const projectListOutput = await this.projectService.list({
      ...input,
      filter: { ...input.filter, languageId: language.id },
    });

    return {
      ...projectListOutput,
      canRead: true,
      canCreate: this.privileges.for(IProject).can('create'),
    };
  }

  async listEngagements(language: Language, input: EngagementListInput) {
    const list = await this.engagementService.list({
      ...input,
      filter: { ...input.filter, languageId: language.id },
    });
    return {
      ...list,
      canRead: true,
      canCreate: false,
    };
  }

  async sponsorStartDate(language: Language): Promise<SecuredDate> {
    const engagementIds = await this.repo.getEngagementIdsForLanguage(language);

    const engagementResults = await (
      await this.loaders.getLoader(EngagementLoader)
    ).loadMany(engagementIds.map((id) => ({ id, view: { active: true } })));
    if (
      engagementResults.some((result) => result instanceof NotFoundException)
    ) {
      return {
        canRead: false,
        canEdit: false,
        value: undefined,
      };
    }
    const engagements = engagementResults.map((result) => {
      if (result instanceof Error) {
        throw result;
      } else {
        return result;
      }
    });

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
        'hasExternalFirstScripture',
      );
    }
  }
}
