import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, Secured, Sensitivity, simpleSwitch } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
  UniquenessError,
} from '../../core';
import {
  CreateLanguage,
  Language,
  LanguageListInput,
  LanguageListOutput,
  UpdateLanguage,
} from './dto';

@Injectable()
export class LanguageService {
  constructor(
    private readonly db: DatabaseService,
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
        node('sg', 'SecurityGroup', { active: true }),
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
      const createLanguage = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateLanguage' }))
        .match([node('rootuser', 'User', { active: true, id: 'rootadminid' })])
        .create([
          [
            node('newLang', 'Language', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name),
          ...this.property('displayName', input.displayName),
          ...this.property('beginFiscalYear', input.beginFiscalYear),
          ...this.property('ethnologuePopulation', input.ethnologuePopulation),
          ...this.property('ethnologueName', input.ethnologueName),
          ...this.property(
            'organizationPopulation',
            input.organizationPopulation
          ),
          ...this.property('rodNumber', input.rodNumber),
          ...this.property('sensitivity', Sensitivity.Low),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
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
          ...this.permission('beginFiscalYear'),
          ...this.permission('ethnologueName'),
          ...this.permission('ethnologuePopulation'),
          ...this.permission('organizationPopulation'),
          ...this.permission('rodNumber'),
          ...this.permission('sensitivity'),
        ])
        .return('newLang.id as id');
      await createLanguage.first();
    } catch (e) {
      if (e instanceof UniquenessError) {
        const prop =
          simpleSwitch(e.label, {
            LanguageName: 'name',
            LanguageDisplayName: 'displayName',
            LanguageRodNumber: 'rodNumber',
          }) ?? e.label;
        throw new BadRequestException(
          `Language with ${prop}="${e.value}" already exists`,
          'Duplicate'
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
      .optionalMatch([...this.propMatch('beginFiscalYear')])
      .optionalMatch([...this.propMatch('ethnologueName')])
      .optionalMatch([...this.propMatch('ethnologuePopulation')])
      .optionalMatch([...this.propMatch('organizationPopulation')])
      .optionalMatch([...this.propMatch('rodNumber')])
      .optionalMatch([...this.propMatch('sensitivity')])
      .return({
        lang: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        canReadName: [{ read: 'canReadNameRead', edit: 'canReadNameEdit' }],
        displayName: [{ value: 'displayName' }],
        canReadDisplayName: [
          { read: 'canReadDisplayNameRead', edit: 'canReadDisplayNameEdit' },
        ],
        beginFiscalYear: [{ value: 'beginFiscalYear' }],
        canReadBeginFiscalYear: [
          {
            read: 'canReadBeginFiscalYearRead',
            edit: 'canReadBeginFiscalYearEdit',
          },
        ],
        ethnologueName: [{ value: 'ethnologueName' }],
        canReadEthnologueName: [
          {
            read: 'canReadEthnologueNameRead',
            edit: 'canReadEthnologueNameEdit',
          },
        ],
        ethnologuePopulation: [{ value: 'ethnologuePopulation' }],
        canReadEthnologuePopulation: [
          {
            read: 'canReadEthnologuePopulationRead',
            edit: 'canReadEthnologuePopulationEdit',
          },
        ],
        organizationPopulation: [{ value: 'organizationPopulation' }],
        canReadOrganizationPopulation: [
          {
            read: 'canReadOrganizationPopulationRead',
            edit: 'canReadOrganizationPopulationEdit',
          },
        ],
        sensitivity: [{ value: 'sensitivity' }],
        canReadSensitivity: [
          { read: 'canReadSensitivityRead', edit: 'canReadSensitivityEdit' },
        ],
        rodNumber: [{ value: 'rodNumber' }],
        canReadRodNumber: [
          { read: 'canReadRodNumberRead', edit: 'canReadRodNumberEdit' },
        ],
      });

    const result = await readLanguage.first();
    if (!result || !result.id) {
      this.logger.warning(`Could not find language`, { id: langId });
      throw new NotFoundException('Could not find language');
    }

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
      beginFiscalYear: {
        value: result.beginFiscalYear,
        canRead: !!result.canReadBeginFiscalYearRead,
        canEdit: !!result.canReadBeginFiscalYearEdit,
      },
      ethnologueName: {
        value: result.ethnologueName,
        canRead: !!result.canReadEthnologueNameRead,
        canEdit: !!result.canReadEthnologueNameEdit,
      },
      ethnologuePopulation: {
        value: result.ethnologuePopulation,
        canRead: !!result.canReadEthnologuePopulationRead,
        canEdit: !!result.canReadEthnologuePopulationEdit,
      },
      organizationPopulation: {
        value: result.organizationPopulation,
        canRead: !!result.canReadOrganizationPopulationRead,
        canEdit: !!result.canReadOrganizationPopulationEdit,
      },
      rodNumber: {
        value: result.rodNumber,
        canRead: !!result.canReadRodNumberRead,
        canEdit: !!result.canReadRodNumberEdit,
      },
      sensitivity: result.sensitivity || Sensitivity.Low,
    };

    return language;
  }

  async update(input: UpdateLanguage, session: ISession): Promise<Language> {
    this.logger.info(`Update language`, { input, userId: session.userId });
    const language = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: language,
      props: [
        'name',
        'displayName',
        'beginFiscalYear',
        'ethnologueName',
        'ethnologuePopulation',
        'organizationPopulation',
        'rodNumber',
      ],
      changes: input,
      nodevar: 'language', // not sure if this is right, just trying to get this to compile - michael
    });
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
      props: [
        'name',
        'displayName',
        'beginFiscalYear',
        'ethnologueName',
        'ethnologuePopulation',
        'organizationPopulation',
        'rodNumber',
        'sensitivity',
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    const items = result.items.map(
      (lang): Language => ({
        ...lang,
        sensitivity: ((lang.sensitivity as unknown) as Secured<Sensitivity>)
          .value!,
      })
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
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
}
