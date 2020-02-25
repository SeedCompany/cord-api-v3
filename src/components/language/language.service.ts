import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import {
  DatabaseService,
  ILogger,
  Logger,
  PropertyUpdaterService,
} from '../../core';
import { ISession } from '../auth';
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
    private readonly propertyUpdater: PropertyUpdaterService,
    @Logger('language:service') private readonly logger: ILogger,
  ) { }

  async create(input: CreateLanguage, session: ISession): Promise<Language> {
    this.logger.info(
      `Mutation create Language: ${input.name} by ${session.userId}`,
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
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Language',
        aclEditProp: 'canCreateLang',
      });

      const result = await this.readOne(id, session);

      return result;
    } catch (e) {
      console.log(e);
      this.logger.error(`Could not create language`);
      throw new Error('Could not create language');
    }
  }

  async readOne(langId: string, session: ISession): Promise<Language> {
    this.logger.info(
      `Query readOne Language: id ${langId} by ${session.userId}`,
    );

    const result = await this.propertyUpdater.readProperties({
      session, id: langId,
      nodevar: "lang",
      props: ['id', 'createdAt', 'name', 'displayName', 'beginFiscalYear', 'ethnologueName', 'ethnologuePopulation', 'organizationPopulation', 'rodNumber']
    });

    if (!result) {
      this.logger.error(`Could not find language: ${langId} `);
      throw new NotFoundException('Could not find language');
    } 
    
    const { id, createdAt, ...rest } = result;

    return {
      id: id.value,
      createdAt: createdAt.value,
      ...rest
    } as Language
  }

  async update(input: UpdateLanguage, session: ISession): Promise<Language> {
    throw new Error('Not implemented');
    this.logger.info(
      `mutation update language ${input.id} by ${session.userId}`,
    );
    const language = await this.readOne(input.id, session);

    return this.propertyUpdater.updateProperties({
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
      await this.propertyUpdater.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async list(
    { page, count, sort, order, filter }: LanguageListInput,
    session: ISession,
  ): Promise<LanguageListOutput> {
    this.logger.info(`query list Languages by ${session.userId}`);
    const result = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (user:User {
          canReadLangs: true
        }),
        (lang:Language {
          active: true
        })-[:name {active: true}]->(name:Property {active: true})
      // WHERE
      //   lang.name CONTAINS $filter
      WITH count(lang) as langs, user
      MATCH
        (lang:Language {active: true})-[:name {active: true}]->(name:Property {active: true}),
        (lang)-[:displayName {active: true}]->(displayName:Property {active: true}),
        (lang)-[:beginFiscalYear {active: true}]->(beginFiscalYear:Property {active: true}),
        (lang)-[:ethnologueName {active: true}]->(ethnologueName:Property {active: true}),
        (lang)-[:ethnologuePopulation {active: true}]->(ethnologuePopulation:Property {active: true}),
        (lang)-[:organizationPopulation {active: true}]->(organizationPopulation:Property {active: true}),
        (lang)-[:rodNumber {active: true}]->(rodNumber:Property {active: true})
      RETURN
        lang.id as id,
        lang.createdAt as createdAt,
        name.value as name,
        displayName.value as displayName,
        beginFiscalYear.value as beginFiscalYear,
        ethnologueName.value as ethnologueName,
        ethnologuePopulation.value as ethnologuePopulation,
        organizationPopulation.value as organizationPopulation,
        rodNumber.value as rodNumber,
        user.canCreateLang as canCreateLang,
        user.canReadLangs as canReadLangs,
        langs as total
      ORDER BY ${sort} ${order}
      SKIP $skip
      LIMIT $count
      `,
        {
          // filter: filter.name, // TODO Handle no filter
          skip: (page - 1) * count,
          count,
          token: session.token,
        },
      )
      .run();

    const items = result.map<Language>(row => ({
      id: row.id,
      createdAt: row.createdAt,
      name: {
        value: row.name,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
      displayName: {
        value: row.displayName,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
      beginFiscalYear: {
        value: row.beginFiscalYear,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
      ethnologueName: {
        value: row.ethnologueName,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
      ethnologuePopulation: {
        value: row.ethnologuePopulation,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
      organizationPopulation: {
        value: row.organizationPopulation,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
      rodNumber: {
        value: row.rodNumber,
        canRead: row.canReadLangs,
        canEdit: row.canCreateLang,
      },
    }));

    const hasMore = (page - 1) * count + count < result[0].total; // if skip + count is less than total there is more

    return {
      items,
      hasMore,
      total: result[0].total,
    };
  }
}
