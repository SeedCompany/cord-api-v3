import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { compact } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  generateId,
  InputException,
  ISession,
  NotFoundException,
  SecuredDate,
  ServerException,
  simpleSwitch,
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
  UniqueProperties,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  collect,
  defaultSorter,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import { EngagementService } from '../engagement';
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
      'CREATE CONSTRAINT ON (n:LanguageName) ASSERT n.value IS UNIQUE',

      // DISPLAYNAME REL
      'CREATE CONSTRAINT ON ()-[r:displayName]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:displayName]-() ASSERT EXISTS(r.createdAt)',

      // DISPLAYNAME NODE
      'CREATE CONSTRAINT ON (n:LanguageDisplayName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LanguageDisplayName) ASSERT n.value IS UNIQUE',

      // RODNUMBER REL
      'CREATE CONSTRAINT ON ()-[r:rodNumber]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:rodNumber]-() ASSERT EXISTS(r.createdAt)',

      // RODNUMBER NODE
      'CREATE CONSTRAINT ON (n:LanguageRodNumber) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LanguageRodNumber) ASSERT n.value IS UNIQUE',

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

  async create(input: CreateLanguage, session: ISession): Promise<Language> {
    const createdAt = DateTime.local();

    await this.authorizationService.checkPower(
      Powers.CreateLanguage,
      session.userId
    );

    await this.authorizationService.checkPower(
      Powers.CreateEthnologueLanguage,
      session.userId
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
      ];

      const createLanguage = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(
          createBaseNode,
          await generateId(),
          'Language',
          secureProps,
          {},
          [],
          session.userId === this.config.rootAdmin.id
        )
        .return('node.id as id');

      const resultLanguage = await createLanguage.first();

      if (!resultLanguage) {
        throw new ServerException('failed to create language');
      }

      const dbLanguage = new DbLanguage();
      await this.authorizationService.processNewBaseNode(
        dbLanguage,
        resultLanguage.id,
        session.userId as string
      );

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

      const result = await this.readOne(resultLanguage.id, session);

      return result;
    } catch (e) {
      if (e instanceof UniquenessError) {
        const prop =
          simpleSwitch(e.label, {
            LanguageName: 'name',
            LanguageDisplayName: 'displayName',
            LanguageRodNumber: 'rodNumber',
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

  async readOne(langId: string, session: ISession): Promise<Language> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Language', { id: langId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('perms', 'Permission'),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property'),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .match([
        node('node'),
        relation('out', '', 'ethnologue'),
        node('eth', 'EthnologueLanguage'),
      ])
      .return('propList, permList, node, eth.id as ethnologueLanguageId')
      .asResult<
        StandardReadResult<DbPropsOfDto<Language>> & {
          ethnologueLanguageId: string;
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
    const securedProps = parseSecuredProperties(
      props,
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      sensitivity: props.sensitivity,
      ethnologue,
      canDelete: true, // TODO
    };
  }

  async update(
    { ethnologue: newEthnologue, ...input }: UpdateLanguage,
    session: ISession
  ): Promise<Language> {
    if (input.hasExternalFirstScripture) {
      await this.verifyExternalFirstScripture(input.id);
    }

    const { ethnologue: oldEthnologue, ...language } = await this.readOne(
      input.id,
      session
    );

    await this.db.sgUpdateProperties({
      session,
      object: language,
      props: [
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
      ],
      changes: input,
      nodevar: 'language', // not sure if this is right, just trying to get this to compile - michael
    });

    // Update EthnologueLanguage
    if (newEthnologue) {
      const readLanguage = this.db
        .query()
        .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
        .match([node('lang', 'Language', { id: input.id })])
        .optionalMatch([
          node('requestingUser'),
          relation('in', '', 'member'),
          node('', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node('canReadEthnologueLanguages', 'Permission', {
            property: 'ethnologue',
            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('lang'),
          relation('out', '', 'ethnologue', { active: true }),
          node('ethnologueLanguage', 'EthnologueLanguage'),
        ])
        .return({
          ethnologueLanguage: [{ id: 'ethnologueLanguageId' }],
        });

      const result = await readLanguage.first();
      if (!result || !result.ethnologueLanguageId) {
        this.logger.warning(`Could not find ethnologue language`, {
          id: input.id,
        });
        throw new NotFoundException(
          'Could not find ethnologue language',
          'language.id'
        );
      }

      await this.ethnologueLanguageService.update(
        result.ethnologueLanguageId,
        newEthnologue,
        session
      );
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    await this.authorizationService.checkPower(
      Powers.DeleteLanguage,
      session.userId
    );

    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find language', 'language.id');
    }

    const baseNodeLabels = ['BaseNode', 'Language'];

    const uniqueProperties: UniqueProperties<Language> = {
      name: ['Property', 'LanguageName'],
      displayName: ['Property', 'LanguageDisplayName'],
      registryOfDialectsCode: ['Property'],
    };

    try {
      await this.db.deleteNodeNew<Language>({
        object,
        baseNodeLabels,
        uniqueProperties,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    { filter, ...input }: LanguageListInput,
    session: ISession
  ): Promise<LanguageListOutput> {
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Language')])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listLocations(
    languageId: string,
    input: LocationListInput,
    session: ISession
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
    session: ISession
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
    session: ISession
  ): Promise<SecuredDate> {
    const result = await this.db
      .query()
      .match([
        node('', 'Language', { id: language.id }),
        relation('in', '', 'language', { active: true }),
        node('engagement', 'LanguageEngagement'),
      ])
      .return(collect('engagement.id', 'engagementIds'))
      .asResult<{ engagementIds: string[] }>()
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
        engagments.map((engagement) => engagement.startDate.value)
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
    languageId: string,
    locationId: string,
    _session: ISession
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
    languageId: string,
    locationId: string,
    _session: ISession
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

  async checkLanguageConsistency(session: ISession): Promise<boolean> {
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
  protected async verifyExternalFirstScripture(id: string) {
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
