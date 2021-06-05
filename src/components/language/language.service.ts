import { Injectable } from '@nestjs/common';
import { compact } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  SecuredDate,
  ServerException,
  Session,
  simpleSwitch,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  ILogger,
  Logger,
  OnIndex,
  UniquenessError,
} from '../../core';
import {
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
} from '../../core/database/results';
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
    // private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly ethnologueLanguageService: EthnologueLanguageService,
    private readonly locationService: LocationService,
    private readonly projectService: ProjectService,
    private readonly engagementService: EngagementService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: LanguageRepository,
    @Logger('language:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      // LANGUAGE NODE
      'CREATE CONSTRAINT ON (n:Language) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Language) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Language) ASSERT EXISTS(n.createdAt)',

      // NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // NAME NODE
      'CREATE CONSTRAINT ON (n:LanguageName) ASSERT EXISTS(n.value)',

      // DISPLAYNAME REL
      'CREATE CONSTRAINT ON ()-[r:displayName]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:displayName]-() ASSERT EXISTS(r.createdAt)',

      // DISPLAYNAME NODE
      'CREATE CONSTRAINT ON (n:LanguageDisplayName) ASSERT EXISTS(n.value)',

      // REGISTRYOFDIALECTSCODE REL
      'CREATE CONSTRAINT ON ()-[r:registryOfDialectsCode]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:registryOfDialectsCode]-() ASSERT EXISTS(r.createdAt)',

      // REGISTRYOFDIALECTSCODE NODE
      'CREATE CONSTRAINT ON (n:RegistryOfDialectsCode) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:RegistryOfDialectsCode) ASSERT n.value IS UNIQUE',

      // ETHNOLOGUELANGUAGE REL
      'CREATE CONSTRAINT ON ()-[r:ethnologue]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:ethnologue]-() ASSERT EXISTS(r.createdAt)',

      // ETHNOLOGUELANGUAGE NODE
      'CREATE CONSTRAINT ON (n:EthnologueLanguage) ASSERT EXISTS(n.id)',

      'CREATE CONSTRAINT ON (n:EthnologueLanguage) ASSERT EXISTS(n.createdAt)',

      // PROPERTY NODE
      //'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.value)',
      //'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.active)',
    ];
  }

  async create(input: CreateLanguage, session: Session): Promise<Language> {
    const createdAt = DateTime.local();

    await this.authorizationService.checkPower(Powers.CreateLanguage, session);

    await this.authorizationService.checkPower(
      Powers.CreateEthnologueLanguage,
      session
    );

    try {
      const ethnologueId = await this.ethnologueLanguageService.create(
        input?.ethnologue,
        session
      );

      const resultLanguage = await this.repo.create(input, session);

      if (!resultLanguage) {
        throw new ServerException('failed to create language');
      }
      // connect ethnologueLanguage to language

      await this.repo.connect(resultLanguage.id, ethnologueId, createdAt);

      await this.authorizationService.processNewBaseNode(
        Language,
        resultLanguage.id,
        session.userId
      );

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
          e
        );
      }
      this.logger.error(`Could not create`, { ...input, exception: e });
      throw new ServerException('Could not create language', e);
    }
  }

  async readOne(langId: ID, session: Session): Promise<Language> {
    const result = await this.repo.readOne(langId, session);
    if (!result) {
      throw new NotFoundException('Could not find language', 'language.id');
    }

    const ethnologue = await this.ethnologueLanguageService.readOne(
      result.ethnologueLanguageId,
      session
    );

    const props = parsePropList(result.propList);
    const securedProps = await this.authorizationService.secureProperties(
      Language,
      props,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      tags: {
        ...securedProps.tags,
        value: securedProps.tags.value ?? [],
      },
      sensitivity: props.sensitivity,
      ethnologue,
      canDelete: await this.repo.checkDeletePermission(langId, session),
    };
  }

  async update(input: UpdateLanguage, session: Session): Promise<Language> {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }

    const object = await this.readOne(input.id, session);
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
        session
      );
    }

    await this.repo.updateProperties(object, simpleChanges);

    return await this.readOne(input.id, session);
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
    { filter, ...input }: LanguageListInput,
    session: Session
  ): Promise<LanguageListOutput> {
    const query = this.repo.list({ filter, ...input }, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listLocations(
    languageId: ID,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationsFromNode(
      'Language',
      languageId,
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

    readProject = readProject.splice((page - 1) * count, count);

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
