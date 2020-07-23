import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  DuplicateException,
  ISession,
  Sensitivity,
  simpleSwitch,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
  UniquenessError,
} from '../../core';
import {
  Location,
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

@Injectable()
export class LanguageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly ethnologueLanguageService: EthnologueLanguageService,
    private readonly locationService: LocationService,
    private readonly projectService: ProjectService,
    @Logger('language:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      // LANGUAGE NODE
      'CREATE CONSTRAINT ON (n:Language) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Language) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Language) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Language) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Language) ASSERT EXISTS(n.owningOrgId)',

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
      'CREATE CONSTRAINT ON (n:EthnologueLanguage) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:EthnologueLanguage) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:EthnologueLanguage) ASSERT EXISTS(n.owningOrgId)',

      // PROPERTY NODE
      //'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.value)',
      //'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.active)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }
  // helper method for defining properties
  property = (prop: string, value: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel =
      simpleSwitch(prop, {
        name: ['LanguageName'],
        displayName: ['LanguageDisplayName'],
        rodNumber: ['LanguageRodNumber'],
      }) ?? [];
    return [
      [
        node('newLang'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, [...propLabel, 'Property'], {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newLang'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newLang'),
      ],
    ];
  };

  propMatch = (property: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async create(input: CreateLanguage, session: ISession): Promise<Language> {
    this.logger.info(`Create language`, { input, userId: session.userId });

    const id = generate();
    const createdAt = DateTime.local();

    try {
      const { ethnologueId } = await this.ethnologueLanguageService.create(
        input?.ethnologue,
        session
      );

      const createLanguage = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateLanguage' }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newLang', ['Language', 'BaseNode'], {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name),
          ...this.property('displayName', input.displayName),
          ...this.property('sensitivity', Sensitivity.Low),
          ...this.property('isDialect', input.isDialect),
          ...this.property('populationOverride', input.populationOverride),
          ...this.property(
            'registryOfDialectsCode',
            input.registryOfDialectsCode
          ),
          ...this.property('leastOfThese', input.leastOfThese),
          ...this.property('leastOfTheseReason', input.leastOfTheseReason),
          ...this.property(
            'displayNamePronunciation',
            input.displayNamePronunciation
          ),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('name'),
          ...this.permission('displayName'),
          ...this.permission('isDialect'),
          ...this.permission('populationOverride'),
          ...this.permission('registryOfDialectsCode'),
          ...this.permission('leastOfThese'),
          ...this.permission('leastOfTheseReason'),
          ...this.permission('sensitivity'),
          ...this.permission('ethnologue'),
          ...this.permission('displayNamePronunciation'),
        ])
        .return('newLang.id as id');

      await createLanguage.first();

      // connect ethnologueLanguage to language
      await this.db
        .query()
        .matchNode('language', 'Language', { id: id, active: true })
        .matchNode('ethnologueLanguage', 'EthnologueLanguage', {
          id: ethnologueId,
          active: true,
        })
        .create([
          node('language'),
          relation('out', '', 'ethnologue', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('ethnologueLanguage'),
        ])
        .run();
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
      throw new ServerException('Could not create language');
    }
    const result = await this.readOne(id, session);

    return result;
  }

  async readOne(langId: string, session: ISession): Promise<Language> {
    this.logger.info(`Read language`, {
      id: langId,
      userId: session.userId,
    });

    const readLanguage = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
      .match([node('lang', 'Language', { active: true, id: langId })])
      .optionalMatch([...this.propMatch('name')])
      .optionalMatch([...this.propMatch('displayName')])
      .optionalMatch([...this.propMatch('isDialect')])
      .optionalMatch([...this.propMatch('populationOverride')])
      .optionalMatch([...this.propMatch('registryOfDialectsCode')])
      .optionalMatch([...this.propMatch('leastOfThese')])
      .optionalMatch([...this.propMatch('leastOfTheseReason')])
      .optionalMatch([...this.propMatch('displayNamePronunciation')])
      .optionalMatch([...this.propMatch('sensitivity')])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadEthnologueLanguages', 'Permission', {
          property: 'ethnologue',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
        relation('out', '', 'ethnologue', { active: true }),
        node('ethnologueLanguage', 'EthnologueLanguage', { active: true }),
      ])
      .return({
        lang: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        canReadName: [{ read: 'canReadNameRead', edit: 'canReadNameEdit' }],
        displayName: [{ value: 'displayName' }],
        canReadDisplayName: [
          { read: 'canReadDisplayNameRead', edit: 'canReadDisplayNameEdit' },
        ],
        sensitivity: [{ value: 'sensitivity' }],
        canReadSensitivity: [
          { read: 'canReadSensitivityRead', edit: 'canReadSensitivityEdit' },
        ],
        isDialect: [{ value: 'isDialect' }],
        populationOverride: [{ value: 'populationOverride' }],
        canReadPopulationOverride: [
          {
            read: 'canReadPopulationOverrideRead',
            edit: 'canReadPopulationOverrideEdit',
          },
        ],
        registryOfDialectsCode: [{ value: 'registryOfDialectsCode' }],
        canReadRegistryOfDialectsCode: [
          {
            read: 'canReadRegistryOfDialectsCodeRead',
            edit: 'canReadRegistryOfDialectsCodeEdit',
          },
        ],
        leastOfThese: [{ value: 'leastOfThese' }],
        canReadLeastOfThese: [
          { read: 'canReadLeastOfTheseRead', edit: 'canReadLeastOfTheseEdit' },
        ],
        leastOfTheseReason: [{ value: 'leastOfTheseReason' }],
        canReadLeastOfTheseReason: [
          {
            read: 'canReadLeastOfTheseReasonRead',
            edit: 'canReadLeastOfTheseReasonEdit',
          },
        ],
        displayNamePronunciation: [{ value: 'displayNamePronunciation' }],
        canReadDisplayNamePronunciation: [
          {
            read: 'canReadDisplayNamePronunciationRead',
            edit: 'canReadDisplayNamePronunciationEdit',
          },
        ],
        ethnologueLanguage: [{ id: 'ethnologueLanguageId' }],
      });

    const result = await readLanguage.first();

    if (!result || !result.id) {
      this.logger.warning(`Could not find language`, { id: langId });
      throw new NotFoundException('Could not find language');
    }

    const { ethnologue } = await this.ethnologueLanguageService.readOne(
      result.ethnologueLanguageId,
      session
    );

    const language: Language = {
      id: result.id,
      createdAt: result.createdAt,
      name: {
        value: result.name,
        canRead: !!result.canReadNameRead,
        canEdit: !!result.canReadNameEdit,
      },
      displayName: {
        value: result.displayName,
        canRead: !!result.canReadDisplayNameRead,
        canEdit: !!result.canReadDisplayNameEdit,
      },
      isDialect: {
        value: result.isDialect,
        canRead: !!result.canReadIsDialectRead,
        canEdit: !!result.canReadIsDialectEdit,
      },
      ethnologue: ethnologue,
      populationOverride: {
        value: result.populationOverride,
        canRead: !!result.canReadPopulationOverrideRead,
        canEdit: !!result.canReadPopulationOverrideEdit,
      },
      registryOfDialectsCode: {
        value: result.registryOfDialectsCode,
        canRead: !!result.canReadRegistryOfDialectsCodeRead,
        canEdit: !!result.canReadRegistryOfDialectsCodeEdit,
      },
      leastOfThese: {
        value: result.leastOfThese,
        canRead: !!result.canReadLeastOfTheseRead,
        canEdit: !!result.canReadLeastOfTheseEdit,
      },
      leastOfTheseReason: {
        value: result.leastOfTheseReason,
        canRead: !!result.canReadLeastOfTheseReasonRead,
        canEdit: !!result.canReadLeastOfTheseReasonEdit,
      },
      sponsorDate: {
        value: result.sponsorDate,
        canRead: !!result.canReadSponsorDateRead,
        canEdit: !!result.canReadSponsorDateEdit,
      },
      displayNamePronunciation: {
        value: result.displayNamePronunciation,
        canRead: !!result.canReadDisplayNamePronunciationRead,
        canEdit: !!result.canReadDisplayNamePronunciationEdit,
      },
      sensitivity: result.sensitivity || Sensitivity.Low,
    };

    return language;
  }

  async listLocations(
    language: Language,
    _input: LocationListInput,
    session: ISession
  ): Promise<SecuredLocationList> {
    const result = await this.db
      .query()
      .matchNode('language', 'Language', { id: language.id, active: true })
      .match([
        node('language'),
        relation('out', '', 'location', { active: true }),
        node('location', {
          active: true,
        }),
      ])
      .return({
        location: [{ id: 'id' }],
      })
      .run();

    const permission = await this.db
      .query()
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canReadLocation', 'Permission', {
            property: 'location',
            active: true,
            read: true,
          }),
        ],
      ])
      .return({
        canReadLocation: [
          {
            read: 'canReadLocationRead',
            create: 'canReadLocationCreate',
          },
        ],
      })
      .first();

    const items = await Promise.all(
      result.map(
        async (location): Promise<Location> => {
          return this.locationService.readOne(location.id, session);
        }
      )
    );

    return {
      items: items,
      total: items.length,
      hasMore: false,
      canCreate: !!permission?.canReadLocationCreate,
      canRead: !!permission?.canReadLocationRead,
    };
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
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('language', 'Language', { id: language.id, active: true })])
      .match([
        node('language'),
        relation('in', '', 'language', { active: true }),
        node('langEngagement', 'LanguageEngagement', {
          active: true,
        }),
        relation('in', '', 'engagement', { active: true }),
        node('project', 'Project', {
          active: true,
        }),
      ]);
    queryProject.return({
      project: [{ id: 'id', createdAt: 'createdAt' }],
      requestingUser: [
        {
          canReadProjects: 'canReadProjects',
          canCreateProject: 'canCreateProject',
        },
      ],
    });

    let readProject = await queryProject.run();
    this.logger.debug(`list projects results`, { total: readProject.length });

    result.total = readProject.length;
    result.hasMore = count * page < result.total ?? true;

    readProject = readProject.splice((page - 1) * count, count);

    result.items = await Promise.all(
      readProject.map(async (project) =>
        this.projectService.readOne(project.id, session)
      )
    );

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
      canCreate: !!readProject[0]?.canCreateProject,
      canRead: !!readProject[0]?.canReadProjects,
    };
  }

  async update(
    { ethnologue: newEthnologue, ...input }: UpdateLanguage,
    session: ISession
  ): Promise<Language> {
    this.logger.info(`Update language`, { input, userId: session.userId });
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
      ],
      changes: input,
      nodevar: 'language', // not sure if this is right, just trying to get this to compile - michael
    });

    // Update EthnologueLanguage
    if (newEthnologue) {
      const readLanguage = this.db
        .query()
        .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
        .match([node('lang', 'Language', { active: true, id: input.id })])
        .optionalMatch([
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canReadEthnologueLanguages', 'Permission', {
            property: 'ethnologue',
            active: true,
            read: true,
          }),
          relation('out', '', 'baseNode', { active: true }),
          node('lang'),
          relation('out', '', 'ethnologue', { active: true }),
          node('ethnologueLanguage', 'EthnologueLanguage', { active: true }),
        ])
        .return({
          ethnologueLanguage: [{ id: 'ethnologueLanguageId' }],
        });

      const result = await readLanguage.first();
      if (!result || !result.ethnologueLanguageId) {
        this.logger.warning(`Could not find ethnologue language`, {
          id: input.id,
        });
        throw new NotFoundException('Could not find ethnologue language');
      }

      await this.ethnologueLanguageService.update(
        result.ethnologueLanguageId,
        newEthnologue,
        session
      );
    }

    return this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    this.logger.info(`mutation delete language: ${id} by ${session.userId}`);
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find language');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }
  }

  async list(
    { page, count, sort, order, filter }: LanguageListInput,
    session: ISession
  ): Promise<LanguageListOutput> {
    const result = await this.db.list<Language>({
      session,
      nodevar: 'language',
      aclReadProp: 'canReadLanguages',
      aclEditProp: 'canCreateLanguage',
      props: ['name', 'displayName', 'sensitivity'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    const items = await Promise.all(
      result.items.map(
        (lang): Promise<Language> => this.readOne(lang.id, session)
      )
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async addLocation(
    languageId: string,
    locationId: string,
    session: ISession
  ): Promise<void> {
    const locationLabel = await this.getLocationLabelById(locationId);

    if (!locationLabel) {
      throw new BadRequestException('Cannot find location');
    }

    await this.removeLocation(languageId, locationId, session);
    await this.db
      .query()
      .matchNode('language', 'Language', { id: languageId, active: true })
      .matchNode('location', locationLabel, {
        id: locationId,
        active: true,
      })
      .create([
        node('language'),
        relation('out', '', 'location', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('location'),
      ])
      .run();
  }

  async removeLocation(
    languageId: string,
    locationId: string,
    _session: ISession
  ): Promise<void> {
    const locationLabel = await this.getLocationLabelById(locationId);

    if (!locationLabel) {
      throw new BadRequestException('Cannot find location');
    }

    await this.db
      .query()
      .matchNode('language', 'Language', { id: languageId, active: true })
      .matchNode('location', locationLabel, {
        id: locationId,
        active: true,
      })
      .match([
        [
          node('language'),
          relation('out', 'rel', 'location', { active: true }),
          node('location'),
        ],
      ])
      .setValues({
        'rel.active': false,
      })
      .run();
  }

  async checkLanguageConsistency(session: ISession): Promise<boolean> {
    const languages = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('lang', 'Language', {
            active: true,
          }),
        ],
      ])
      .return('lang.id as id')
      .run();

    const yayNay = await Promise.all(
      languages.map(async (lang) => {
        return this.db.hasProperties({
          session,
          id: lang.id,
          props: ['name', 'displayName'],
          nodevar: 'Language',
        });
      })
    );

    return yayNay.every((n) => n);
  }

  async getLocationLabelById(id: string): Promise<string | undefined> {
    const query = `
    MATCH (place {id: $id, active: true}) RETURN labels(place) as labels
    `;
    const results = await this.db.query().raw(query, { id }).first();
    // MATCH one of these labels.
    const label = first(
      intersection(results?.labels, ['Country', 'Region', 'Zone'])
    );

    return label;
  }
}
