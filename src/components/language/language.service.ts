import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { isNotFalsy, setHas, setOf } from '@seedcompany/common';
import { DateTime } from 'luxon';
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
  LanguageUpdate,
  type UpdateLanguage,
} from './dto';
import { EthnologueLanguageService } from './ethnologue-language';
import { LanguageChannels } from './language.channels';
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
    private readonly channels: LanguageChannels,
    private readonly repo: LanguageRepository,
    @Logger('language:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreateLanguage): Promise<Language> {
    this.privileges.for(Language).verifyCan('create');

    const resultLanguage = await this.repo.create(input);

    this.channels.publishToAll('created', {
      language: resultLanguage.id,
      at: resultLanguage.createdAt,
    });

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

  async update(input: UpdateLanguage, view?: ObjectView) {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }
    const {
      registryOfDialectsCode,
      changeset,
      ethnologue: ethnologueInput,
      ...props
    } = input;

    const language = await this.repo.readOne(input.id, view);
    const changes = this.repo.getActualChanges(language, {
      ...props,
      registryOfLanguageVarietiesCode:
        props.registryOfLanguageVarietiesCode ?? registryOfDialectsCode,
    });
    const ethnologueUpdate = this.ethnologueLanguageService.prepChanges(
      ethnologueInput,
      language.ethnologue,
      language.sensitivity,
    );

    if (!ethnologueUpdate && Object.keys(changes).length === 0) {
      return { language: this.secure(language) };
    }

    this.privileges.for(Language, language).verifyChanges(changes);

    const [updated] = await Promise.all([
      this.repo.update({ id: language.id, ...changes }, view?.changeset),
      ethnologueUpdate &&
        this.ethnologueLanguageService.update(
          language.ethnologue.id,
          ethnologueUpdate.changes,
        ),
    ]);

    const updatedPayload = this.channels.publishToAll('updated', {
      language: updated.id,
      at: DateTime.now(),
      updated: {
        ...LanguageUpdate.fromInput(changes),
        ethnologue: ethnologueUpdate?.updated,
      },
      previous: {
        ...LanguageUpdate.pickPrevious(language, changes),
        ethnologue: ethnologueUpdate?.previous,
      },
    });

    return {
      language: this.secure(updated),
      payload: updatedPayload,
    };
  }

  async delete(id: ID) {
    const object = await this.readOne(id);

    this.privileges.for(Language, object).verifyCan('delete');

    const { at } = await this.repo.deleteNode(object).catch((exception) => {
      throw new ServerException('Failed to delete', exception);
    });

    return this.channels.publishToAll('deleted', {
      language: id,
      at,
    });
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

  async addLocation(language: ID<Language>, location: ID<'Location'>) {
    const changedAt = await this.locationService.addLocationToNode(
      'Language',
      language,
      'locations',
      location,
    );
    if (!changedAt) {
      return undefined;
    }
    return this.channels.publishToAll('updated', {
      language,
      at: changedAt,
      updated: { locations: { Added: [location] } },
      previous: {},
    });
  }

  async removeLocation(language: ID<'Language'>, location: ID<'Location'>) {
    const changedAt = await this.locationService.removeLocationFromNode(
      'Language',
      language,
      'locations',
      location,
    );
    if (!changedAt) {
      return undefined;
    }
    return this.channels.publishToAll('updated', {
      language,
      at: changedAt,
      updated: { locations: { Removed: [location] } },
      previous: {},
    });
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
