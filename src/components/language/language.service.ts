import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { ForbiddenError } from 'apollo-server-core';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, Sensitivity } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
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
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel =
      prop === 'name'
        ? 'LanguageName:Property'
        : prop === 'displayName'
        ? 'LanguageDisplayName:Property'
        : prop === 'rodNumber'
        ? 'LanguageRodNumber:Property'
        : 'Property';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (
    property: string,
    sg: string,
    baseNode: string,
    read: boolean,
    edit: boolean
  ) => {
    const createdAt = DateTime.local();
    return [
      [
        node(sg),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read,
          edit,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };
  async create(input: CreateLanguage, session: ISession): Promise<Language> {
    this.logger.info(
      `Mutation create Language: ${input.name} by ${session.userId}`
    );

    const id = generate();
    const createdAt = DateTime.local();

    try {
      const createLanguage = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateLanguage' }))
        .create([
          [
            node('newLang', 'Language', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newLang'),
          ...this.property('displayName', input.displayName, 'newLang'),
          ...this.property('beginFiscalYear', input.beginFiscalYear, 'newLang'),
          ...this.property(
            'ethnologuePopulation',
            input.ethnologuePopulation,
            'newLang'
          ),
          ...this.property('ethnologueName', input.ethnologueName, 'newLang'),
          ...this.property(
            'organizationPopulation',
            input.organizationPopulation,
            'newLang'
          ),
          ...this.property('rodNumber', input.rodNumber, 'newLang'),
          ...this.property('sensitivity', Sensitivity.Low, 'newLang'),
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
          ...this.permission('name', 'adminSG', 'newLang', true, true),
          ...this.permission('name', 'readerSG', 'newLang', true, false),
          ...this.permission('displayName', 'adminSG', 'newLang', true, true),
          ...this.permission('displayName', 'readerSG', 'newLang', true, false),
          ...this.permission(
            'beginFiscalYear',
            'adminSG',
            'newLang',
            true,
            true
          ),
          ...this.permission(
            'beginFiscalYear',
            'readerSG',
            'newLang',
            true,
            false
          ),
          ...this.permission(
            'ethnologueName',
            'adminSG',
            'newLang',
            true,
            true
          ),
          ...this.permission(
            'ethnologueName',
            'readerSG',
            'newLang',
            true,
            false
          ),
          ...this.permission(
            'ethnologuePopulation',
            'adminSG',
            'newLang',
            true,
            true
          ),
          ...this.permission(
            'ethnologuePopulation',
            'readerSG',
            'newLang',
            true,
            false
          ),
          ...this.permission(
            'organizationPopulation',
            'adminSG',
            'newLang',
            true,
            true
          ),
          ...this.permission(
            'organizationPopulation',
            'readerSG',
            'newLang',
            true,
            false
          ),
          ...this.permission('rodNumber', 'adminSG', 'newLang', true, true),
          ...this.permission('rodNumber', 'readerSG', 'newLang', true, false),

          ...this.permission('sensitivity', 'adminSG', 'newLang', true, true),
          ...this.permission('sensitivity', 'readerSG', 'newLang', true, false),
        ])
        .return('newLang.id as id');
      await createLanguage.first();
    } catch (e) {
      // if fail to create, see if already exists
      const lookup = this.db
        .query()
        .match([
          node('lang', 'Language', { active: true }),
          relation('out', 'name', 'name', { active: true }),
          node('langName', 'LanguageName', { active: true, value: input.name }),
        ])
        .return({ lang: [{ id: 'langId' }] });

      const lang = await lookup.first();
      if (lang) {
        this.logger.error('Language name already exists', {
          input,
          userId: session.userId,
        });
        throw new ForbiddenError('Could not create language. Name taken');
      }
      this.logger.error(`Could not create`, { ...input, exception: e });
      throw new ForbiddenError('Could not create language');
    }
    const result = await this.readOne(id, session);

    return result;
  }

  async readOne(langId: string, session: ISession): Promise<Language> {
    this.logger.info(
      `Query readOne Language: id ${langId} by ${session.userId}`
    );

    // const result = await this.db.readProperties({
    //   session,
    //   id: langId,
    //   props: [
    //     'id',
    //     'createdAt',
    //     'name',
    //     'displayName',
    //     'beginFiscalYear',
    //     'ethnologueName',
    //     'ethnologuePopulation',
    //     'organizationPopulation',
    //     'sensitivity',
    //     'rodNumber',
    //   ],
    //   nodevar: 'lang',
    // });
    const readLanguage = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
      .match([node('lang', 'Language', { active: true, id: langId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadDisplayName', 'Permission', {
          property: 'displayName',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadBeginFiscalYear', 'Permission', {
          property: 'beginFiscalYear',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadEthnologueName', 'Permission', {
          property: 'ethnologueName',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadEthnologuePopulation', 'Permission', {
          property: 'ethnologuePopulation',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadOrganizationPopulation', 'Permission', {
          property: 'organizationPopulation',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadRodNumber', 'Permission', {
          property: 'rodNumber',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadSensitivity', 'Permission', {
          property: 'sensitivity',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'name', { active: true }),
        node('name', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'displayName', { active: true }),
        node('displayName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'beginFiscalYear', { active: true }),
        node('beginFiscalYear', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'ethnologueName', { active: true }),
        node('ethnologueName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'ethnologuePopulation', { active: true }),
        node('ethnologuePopulation', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'ethnologuePopulation', { active: true }),
        node('ethnologuePopulation', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'organizationPopulation', { active: true }),
        node('organizationPopulation', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'rodNumber', { active: true }),
        node('rodNumber', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('lang'),
        relation('out', '', 'sensitivity', { active: true }),
        node('sensitivity', 'Property', { active: true }),
      ])
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
      this.logger.error(`Could not find language: ${langId} `);
      throw new NotFoundException('Could not find language');
    }

    const language: Language = {
      id: result.id,
      createdAt: result.createdAt,
      name: {
        value: result.name,
        canRead: result.canReadNameRead,
        canEdit: result.canReadNameEdit,
      },
      displayName: {
        value: result.displayName,
        canRead: result.canReadDisplayNameRead,
        canEdit: result.canReadDisplayNameEdit,
      },
      beginFiscalYear: {
        value: result.beginFiscalYear,
        canRead: result.canReadBeginFiscalYearRead,
        canEdit: result.canReadBeginFiscalYearEdit,
      },
      ethnologueName: {
        value: result.ethnologueName,
        canRead: result.canReadEthnologueNameRead,
        canEdit: result.canReadEthnologueNameEdit,
      },
      ethnologuePopulation: {
        value: result.ethnologuePopulation,
        canRead: result.canReadEthnologuePopulationRead,
        canEdit: result.canReadEthnologuePopulationEdit,
      },
      organizationPopulation: {
        value: result.organizationPopulation,
        canRead: result.canReadOrganizationPopulationRead,
        canEdit: result.canReadOrganizationPopulationEdit,
      },
      rodNumber: {
        value: result.rodNumber,
        canRead: result.canReadRodNumberRead,
        canEdit: result.canReadRodNumberEdit,
      },
      sensitivity: result.sensitivity,
    };

    return language;
  }

  async update(input: UpdateLanguage, session: ISession): Promise<Language> {
    this.logger.info(
      `mutation update language ${input.id} by ${session.userId}`
    );
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
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
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
