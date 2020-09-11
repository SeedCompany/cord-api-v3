import { Injectable } from '@nestjs/common';
import { contains, node, relation } from 'cypher-query-builder';
import { first, intersection, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  InputException,
  ISession,
  NotFoundException,
  Sensitivity,
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
} from '../../core';
import {
  calculateTotalAndPaginateList,
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
  private readonly securedProperties = {
    name: true,
    displayName: true,
    isDialect: true,
    populationOverride: true,
    registryOfDialectsCode: true,
    leastOfThese: true,
    leastOfTheseReason: true,
    displayNamePronunciation: true,
    sponsorStartDate: true,
    signLanguageCode: true,
  };

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
    return [
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
  }
  // helper method for defining properties
  property = (prop: string, value: any) => {
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
        node('node'),
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
        node('node'),
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
    const createdAt = DateTime.local();

    try {
      const ethnologueId = await this.ethnologueLanguageService.create(
        input?.ethnologue,
        session
      );

      const secureProps = [
        {
          key: 'name',
          value: input.name,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
          label: 'LanguageName',
        },
        {
          key: 'displayName',
          value: input.displayName,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
          label: 'LanguageDisplayName',
        },
        {
          key: 'sensitivity',
          value: Sensitivity.Low,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'isDialect',
          value: input.isDialect,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'populationOverride',
          value: input.populationOverride,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'registryOfDialectsCode',
          value: input.registryOfDialectsCode,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'leastOfThese',
          value: input.leastOfThese,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'leastOfTheseReason',
          value: input.leastOfTheseReason,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'displayNamePronunciation',
          value: input.displayNamePronunciation,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
        {
          key: 'signLanguageCode',
          value: input.signLanguageCode,
          addToAdminSg: true,
          addToWriterSg: false,
          addToReaderSg: true,
          isPublic: false,
          isOrgPublic: false,
        },
      ];

      const createLanguage = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(
          createBaseNode,
          'Language',
          secureProps,
          {
            owningOrgId: session.owningOrgId,
          },
          [],
          session.userId === this.config.rootAdmin.id
        )
        .create([...this.permission('ethnologue')])
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
          active: true,
        })
        .matchNode('ethnologueLanguage', 'EthnologueLanguage', {
          id: ethnologueId,
          active: true,
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
      .match([node('node', 'Language', { active: true, id: langId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .match([
        node('node'),
        relation('out', '', 'ethnologue'),
        node('eth', 'EthnologueLanguage', { active: true }),
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
    };
  }

  async update(
    { ethnologue: newEthnologue, ...input }: UpdateLanguage,
    session: ISession
  ): Promise<Language> {
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
        'signLanguageCode',
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
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find language', 'language.id');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
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
    const label = 'Language';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.name
          ? [
              relation('out', '', 'name', { active: true }),
              node('name', 'Property', { active: true }),
            ]
          : []),
      ])
      .call((q) =>
        filter.name ? q.where({ name: { value: contains(filter.name) } }) : q
      )
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('toLower(prop.value)', order)
          : q.with('*').orderBy(`toLower(node.${sort})`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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
          return await this.locationService.readOne(location.id, session);
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
      readProject.map(
        async (project) =>
          await this.projectService.readOne(project.id, session)
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

  async addLocation(
    languageId: string,
    locationId: string,
    session: ISession
  ): Promise<void> {
    const locationLabel = await this.getLocationLabelById(locationId);

    if (!locationLabel) {
      throw new InputException('Cannot find location', 'locationId');
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
      throw new InputException('Cannot find location', 'locationId');
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
