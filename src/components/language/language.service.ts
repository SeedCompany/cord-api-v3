import { Injectable, NotFoundException } from '@nestjs/common';
import { ForbiddenError } from 'apollo-server-core';
import { node } from 'cypher-query-builder';
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

  async create(input: CreateLanguage, session: ISession): Promise<Language> {
    this.logger.info(
      `Mutation create Language: ${input.name} by ${session.userId}`
    );

    const id = generate();
    const acls = {
      canReadName: true,
      canEditName: true,
      canReadDisplayName: true,
      canEditDisplayName: true,
      canReadBeginFiscalYear: true,
      canEditBeginFiscalYear: true,
      canReadEthnologueName: true,
      canEditEthnologueName: true,
      canReadEthnologuePopulation: true,
      canEditEthnologuePopulation: true,
      canReadOrganizationPopulation: true,
      canEditOrganizationPopulation: true,
      canReadRodNumber: true,
      canEditRodNumber: true,
    };

    try {
      await this.db.createNode({
        session,
        type: Language.classType,
        input: { id, ...input, sensitivity: Sensitivity.Low }, // setting all language sensitivity to low by default for now
        acls,
        aclEditProp: 'canCreateLang',
      });

      //set Property Labels
      const query = `
        MATCH
          (lang:Language {id: $id, active: true})-[:name]->(nameProp:Property),
          (lang {id: $id, active: true})-[:displayName]->(displayProp:Property),
          (lang {id: $id, active: true})-[:rodNumber]->(rodNumberProp:Property)
        SET nameProp :LanguageName, displayProp :LanguageDisplayName, rodNumberProp :LanguageRodNumber
      `;
      await this.db
        .query()
        .raw(query, {
          id,
        })
        .run();

      const result = await this.readOne(id, session);

      return result;
    } catch (e) {
      this.logger.error(`Could not create`, { ...input, exception: e });
      throw new ForbiddenError('Could not create language');
    }
  }

  async readOne(langId: string, session: ISession): Promise<Language> {
    this.logger.info(
      `Query readOne Language: id ${langId} by ${session.userId}`
    );

    const result = await this.db.readProperties({
      session,
      id: langId,
      props: [
        'id',
        'createdAt',
        'name',
        'displayName',
        'beginFiscalYear',
        'ethnologueName',
        'ethnologuePopulation',
        'organizationPopulation',
        'sensitivity',
        'rodNumber',
      ],
      nodevar: 'lang',
    });

    if (!result) {
      this.logger.error(`Could not find language: ${langId} `);
      throw new NotFoundException('Could not find language');
    }

    let language = result as any;
    language.id = result.id.value;
    language.createdAt = result.createdAt.value;
    language.sensitivity = result.sensitivity.value as Sensitivity;
    language = language as Language;

    return language;
  }

  async update(input: UpdateLanguage, session: ISession): Promise<Language> {
    throw new Error('Not implemented');
    this.logger.info(
      `mutation update language ${input.id} by ${session.userId}`
    );
    const language = await this.readOne(input.id, session);

    return this.db.updateProperties({
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
      throw e;
    }
  }

  async list(
    { page, count, sort, order, filter }: LanguageListInput,
    session: ISession
  ): Promise<LanguageListOutput> {
    const result = await this.db.list<Language>({
      session,
      nodevar: 'language',
      aclReadProp: 'canReadLangs',
      aclEditProp: 'canCreateLang',
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

    return (
      await Promise.all(
        languages.map(async (lang) => {
          return this.db.hasProperties({
            session,
            id: lang.id,
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
            nodevar: 'Language',
          });
        })
      )
    ).every((n) => n);
  }
}
