import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { compact } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  generateId,
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
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  OnIndex,
  UniquenessError,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  collect,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
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
import { DbLanguage } from './model';
import { languageListFilter } from './query.helpers';

@Injectable()
export class LanguageService {
  private readonly securedProperties = {
    name: true,
    displayName: true,
    isDialect: true,
    populationOverride: true,
    registryOfDialectsCode: true,
    leastOfThese: true,
    leastOfTheseReason: true,
    displayNamePronunciation: true,
    isSignLanguage: true,
    signLanguageCode: true,
    sponsorEstimatedEndDate: true,
    hasExternalFirstScripture: true,
    tags: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly ethnologueLanguageService: EthnologueLanguageService,
    private readonly locationService: LocationService,
    private readonly projectService: ProjectService,
    private readonly engagementService: EngagementService,
    private readonly authorizationService: AuthorizationService,
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

      const secureProps = [
        {
          key: 'name',
          value: input.name,
          isPublic: true,
          isOrgPublic: false,
          label: 'LanguageName',
        },
        {
          key: 'displayName',
          value: input.displayName,
          isPublic: false,
          isOrgPublic: false,
          label: 'LanguageDisplayName',
        },
        {
          key: 'sensitivity',
          value: input.sensitivity,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'isDialect',
          value: input.isDialect,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'populationOverride',
          value: input.populationOverride,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'registryOfDialectsCode',
          value: input.registryOfDialectsCode,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'leastOfThese',
          value: input.leastOfThese,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'leastOfTheseReason',
          value: input.leastOfTheseReason,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'displayNamePronunciation',
          value: input.displayNamePronunciation,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'isSignLanguage',
          value: input.isSignLanguage,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'signLanguageCode',
          value: input.signLanguageCode,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'sponsorEstimatedEndDate',
          value: input.sponsorEstimatedEndDate,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'hasExternalFirstScripture',
          value: input.hasExternalFirstScripture,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'tags',
          value: input.tags,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'canDelete',
          value: true,
          isPublic: false,
          isOrgPublic: false,
        },
      ];

      const createLanguage = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, await generateId(), 'Language', secureProps)
        .return('node.id as id');

      const resultLanguage = await createLanguage.first();

      if (!resultLanguage) {
        throw new ServerException('failed to create language');
      }

      // connect ethnologueLanguage to language
      await this.db
        .query()
        .matchNode('language', 'Language', {
          id: resultLanguage.id,
        })
        .matchNode('ethnologueLanguage', 'EthnologueLanguage', {
          id: ethnologueId,
        })
        .create([
          node('language'),
          relation('out', '', 'ethnologue', {
            active: true,
            createdAt,
          }),
          node('ethnologueLanguage'),
        ])
        .run();

      const dbLanguage = new DbLanguage();
      await this.authorizationService.processNewBaseNode(
        dbLanguage,
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
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Language', { id: langId })])
      .call(matchPropList)
      .match([
        node('node'),
        relation('out', '', 'ethnologue'),
        node('eth', 'EthnologueLanguage'),
      ])
      .return('propList, node, eth.id as ethnologueLanguageId')
      .asResult<
        StandardReadResult<DbPropsOfDto<Language>> & {
          ethnologueLanguageId: ID;
        }
      >();

    const result = await query.first();
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
      canDelete: await this.db.checkDeletePermission(langId, session),
    };
  }

  async update(
    { ethnologue: newEthnologue, ...input }: UpdateLanguage,
    session: Session
  ): Promise<Language> {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }

    const object = await this.readOne(input.id, session);

    const props: Array<keyof typeof object> = [
      'name',
      'displayName',
      'isDialect',
      'populationOverride',
      'registryOfDialectsCode',
      'leastOfThese',
      'leastOfTheseReason',
      'displayNamePronunciation',
      'isSignLanguage',
      'signLanguageCode',
      'sensitivity',
      'sponsorEstimatedEndDate',
      'hasExternalFirstScripture',
      'tags',
    ];
    await this.authorizationService.verifyCanEditChanges(object, props, input);
    if (newEthnologue) {
      await this.authorizationService.verifyCanEdit(object, 'ethnologue');
    }

    await this.db.updateProperties({
      type: 'Language',
      object: object,
      props: props,
      changes: input,
      skipAuth: true, // skipping Auth because already checked above
    });

    // Update EthnologueLanguage
    if (newEthnologue) {
      await this.ethnologueLanguageService.update(
        object.ethnologue.id,
        newEthnologue,
        session
      );
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find language', 'language.id');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Language'
      );

    try {
      await this.db.deleteNodeNew<Language>({
        object,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    { filter, ...input }: LanguageListInput,
    session: Session
  ): Promise<LanguageListOutput> {
    const languageSortMap: Partial<Record<typeof input.sort, string>> = {
      name: 'toLower(prop.value)',
      sensitivity: 'sensitivityValue',
    };

    const sortBy = languageSortMap[input.sort] ?? 'prop.value';

    const sensitivityCase = `case prop.value
        when 'High' then 3
        when 'Medium' then 2
        when 'Low' then 1
      end as sensitivityValue`;

    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Language')])
      .call(languageListFilter, filter)
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        (q, sort, order) =>
          ['id', 'createdAt'].includes(sort)
            ? q.with('*').orderBy(`node.${sort}`, order)
            : q
                .match([
                  node('node'),
                  relation('out', '', sort, { active: true }),
                  node('prop', 'Property'),
                ])
                .with([
                  '*',
                  ...(input.sort === 'sensitivity' ? [sensitivityCase] : []),
                ])
                .orderBy(sortBy, order)
      );

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

    const queryProject = this.db
      .query()
      .match([node('language', 'Language', { id: language.id })])
      .match([
        node('language'),
        relation('in', '', 'language', { active: true }),
        node('', 'LanguageEngagement'),
        relation('in', '', 'engagement', { active: true }),
        node('project', 'Project'),
      ])
      .return({ project: [{ id: 'id', createdAt: 'createdAt' }] });

    let readProject = await queryProject.run();
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
    const result = await this.db
      .query()
      .match([
        node('', 'Language', { id: language.id }),
        relation('in', '', 'language', { active: true }),
        node('engagement', 'LanguageEngagement'),
      ])
      .return(collect('engagement.id', 'engagementIds'))
      .asResult<{ engagementIds: ID[] }>()
      .first();

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

  async checkLanguageConsistency(session: Session): Promise<boolean> {
    const languages = await this.db
      .query()
      .match([matchSession(session), [node('lang', 'Language')]])
      .return('lang.id as id')
      .run();

    const yayNay = await Promise.all(
      languages.map(async (lang) => {
        return await this.db.hasProperties({
          session,
          id: lang.id,
          props: ['name', 'displayName'],
          nodevar: 'Language',
        });
      })
    );

    return yayNay.every((n) => n);
  }

  /**
   * Check if the language has no engagements that have firstScripture=true.
   */
  protected async verifyExternalFirstScripture(id: ID) {
    const engagement = await this.db
      .query()
      .match([
        node('language', 'Language', { id }),
        relation('in', '', 'language', { active: true }),
        node('languageEngagement', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', { active: true }),
        node('firstScripture', 'Property'),
      ])
      .where({
        firstScripture: {
          value: true,
        },
      })
      .return('languageEngagement')
      .first();

    if (engagement) {
      throw new InputException(
        'hasExternalFirstScripture can be set to true if the language has no engagements that have firstScripture=true',
        'language.hasExternalFirstScripture'
      );
    }
  }
}
