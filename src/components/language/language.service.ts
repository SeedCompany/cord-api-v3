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
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  ChildBaseNodeMetaProperty,
  ConfigService,
  DatabaseService,
  filterByString,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  OnIndex,
  runListQuery,
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
          property: prop,
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

  async create(input: CreateLanguage, session: ISession): Promise<string> {
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
    // const result = await this.readOne(id, session);

    return id;
  }

  async readOne(langId: string, session: ISession): Promise<Language> {
    this.logger.info(`Read language`, {
      id: langId,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    /*
          MATCH (requestingUser:User { active: true, id: 'rootadminid' })
          MATCH (node:Language { active: true })
          WHERE node.id = 'YszZRgDw-'
          MATCH (requestingUser)<-[:member*1..]-(:SecurityGroup { active: true })-[:permission]->(perms:Permission { active: true })-[:baseNode]->(node)
          with collect(perms) as permList, node
          MATCH (node)-[{active: true}]->(props:Property {active: true})
          with collect(props) as propList, permList, node
          return permList, propList, labels(node)
     */

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Language', { active: true, id: langId })])
      .match([
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
      // .with('collect(distinct props) as propList, permList, node')
      // .match([
      //   node('node'),
      //   relation('out', '', 'ethnologue', { active: true }),
      //   node('eth', 'EthnologueLanguage', { active: true }),
      // ])
      // .return('permList, propList, node, eth.id as ethId');

    /*
    MATCH (node)-[r {active: true}]->(props:Property {active: true})
    with {value: props.value, property: type(r)} as property, permList, node
    with {id: node.id, properties: collect(property)} as item, permList
    with collect(item) as items, permList
    return items, permList
    */



    // printActualQuery(this.logger, query);
    // console.log('query', query.toString());
    const result: any = await query.first();

    // console.log('result', JSON.stringify(result));

    const response: any = {
      id: result.node.properties.id,
      createdAt: result.node.properties.createdAt,
      // name: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // displayName: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // isDialect: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // populationOverride: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // registryOfDialectsCode: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // leastOfThese: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // leastOfTheseReason: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // displayNamePronunciation: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // sensitivity: '',
      // sponsorDate: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
      // ethnologue: {
      //   value: null,
      //   canRead: false,
      //   canEdit: false,
      // },
    };

    // console.log('propList', result.propList)
    for (const record of result.permList) {
      if (!response[record.properties.property]) {
        response[record.properties.property] = {}
      }
      if (record?.properties && record?.properties?.read === true && response[record.properties.property]) {
        response[record.properties.property].canRead = true
      } else {
        response[record.properties.property].canRead = false
      }

      if (record?.properties && record?.properties?.edit === true && response[record.properties.property]) {
        response[record.properties.property].canEdit = true
      } else {
        response[record.properties.property].canEdit = false
      }
    }

    for (const record of result.propList) {
      if (!response[record.property]) {
        response[record.property] = {}
      }
      if (record?.property === 'sensitivity') {
        response[record.property] = record.value;
      } else if (response[record?.property] && response[record?.property].canRead === true) {
        response[record.property].value = record.value
      } else {
        response[record.property].value = false
      }
    }

    if (response.ethnologue && response.ethnologue.canRead === true) {
      response.ethnologueLanguageId = result.ethnologueLanguageId;
    }

    // console.log('response', response);
    // console.log(JSON.stringify(response));

    // for (const record of result.permList) {
    //   if (record.properties.read === true) {
    //     response[record.properties.property].read = true;
    //   }
    //   if (record.properties.edit === true) {
    //     response[record.properties.property].edit = true;
    //   }
    // }

    return (response as unknown) as Language;

    // const props = [
    //   'name',
    //   'displayName',
    //   'isDialect',
    //   'populationOverride',
    //   'registryOfDialectsCode',
    //   'leastOfThese',
    //   'leastOfTheseReason',
    //   'displayNamePronunciation',
    //   'sensitivity',
    //   'sponsorDate',
    // ];

    // const baseNodeMetaProps = ['id', 'createdAt'];

    // const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
    //   {
    //     parentBaseNodePropertyKey: 'ethnologue',
    //     parentRelationDirection: 'out',
    //     childBaseNodeLabel: 'EthnologueLanguage',
    //     childBaseNodeMetaPropertyKey: 'id',
    //     returnIdentifier: 'ethnologueLanguageId',
    //   },
    // ];

    // const query = this.db
    //   .query()
    //   .call(matchRequestingUser, session)
    //   .call(matchUserPermissions, 'Language', langId)
    //   .call(addAllSecureProperties, ...props)
    //   .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
    //   .with([
    //     ...props.map(addPropertyCoalesceWithClause),
    //     ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
    //     ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
    //     'node',
    //   ])
    //   .returnDistinct([
    //     ...props,
    //     ...baseNodeMetaProps,
    //     ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
    //     'labels(node) as labels',
    //   ]);

    // printActualQuery(this.logger, query);

    // const result = await query.first();
    // if (!result) {
    //   throw new NotFoundException('Could not find language');
    // }

    // const { ethnologue } = await this.ethnologueLanguageService.readOne(
    //   result.ethnologueLanguageId,
    //   session
    // );
    // const response: any = {
    //   ...result,
    //   ethnologue: ethnologue,
    //   sensitivity: result.sensitivity.value || Sensitivity.Low,
    // };

    // return (response as unknown) as Language;
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
    { filter, ...input }: LanguageListInput,
    session: ISession
  ): Promise<LanguageListOutput> {
    const label = 'Language';
    const baseNodeMetaProps = ['id', 'createdAt'];
    // const unsecureProps = [''];
    const secureProps = [
      'name',
      'displayName',
      'isDialect',
      'populationOverride',
      'registryOfDialectsCode',
      'leastOfThese',
      'leastOfTheseReason',
      'displayNamePronunciation',
      'sensitivity',
      'sponsorDate',
    ];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'ethnologue',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'EthnologueLanguage',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'ethnologueLanguageId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      // .call(matchUserPermissions, 'Language');

    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }

    // match on the rest of the properties of the object requested
    // query
    //   .call(
    //     addAllSecureProperties,
    //     ...secureProps
    //     //...unsecureProps
    //   )
    //   .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
    //   // form return object
    //   // ${listWithUnsecureObject(unsecureProps)}, // removed from a few lines down
    //   .with(
    //     `
    //       {
    //         ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
    //         ${listWithSecureObject(secureProps)},
    //         ${childBaseNodeMetaProps
    //           .map(
    //             (x) =>
    //               `${x.returnIdentifier}: ${x.parentBaseNodePropertyKey}.${x.childBaseNodeMetaPropertyKey}`
    //           )
    //           .join(', ')}
    //       } as node
    //     `
    //   );

    query
      .match([node('node', 'Language', { active: true })])

    const result: LanguageListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );
    // console.log('result',  result.items)
    const items = await Promise.all(
      result.items.map(async (item) => {
        const language = await this.readOne((item as any).properties.id, session);
        const { ethnologue } = await this.ethnologueLanguageService.readOneSimple(
          (language as any).ethnologueLanguageId,
          session
        );

        // console.log('language', language)
        return {
          ...(item as any).properties,
          ...language,
          // sensitivity: (item as any).sensitivity.value || Sensitivity.Low,
          ethnologue: ethnologue,
        };
      })
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
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
        this.projectService.readOneSimple(project.id, session)
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
