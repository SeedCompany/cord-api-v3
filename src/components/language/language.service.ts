import {
  CreateLanguage,
  Language,
  LanguageListInput,
  LanguageListOutput,
  UpdateLanguage,
} from './dto';
import { ILogger, Logger, PropertyUpdaterService } from '../../core';
import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../core';
import { IRequestUser } from '../../common';
import { generate } from 'shortid';
import { loggers } from 'winston';

@Injectable()
export class LanguageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly propertyUpdater: PropertyUpdaterService,
    @Logger('user:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreateLanguage, token: IRequestUser): Promise<Language> {
    this.logger.info(
      `Mutation create Language: ${input.name} by ${token.userId}`,
    );
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {
            active: true,
            value: $token
          })
          <-[:token {active: true}]-
          (user:User {
            active: true,
            canCreateLang: true
          })
        CREATE
          (lang:Language {
            active: true,
            createdAt: datetime(),
            id: $id
          })-[nameRel:name {active: true}]->
          (name:LangName:Property {
            active: true,
            value: $name
          }),
          (lang)-[:displayName {active: true}]->(displayName:Property {
            active: true,
            value: $displayName
          }),
          (lang)-[:beginFiscalYear {active: true}]->(beginFiscalYear:Property {
            active: true,
            value: $beginFiscalYear
          }),
          (lang)-[:ethnologueName {active: true}]->(ethnologueName:Property {
            active: true,
            value: $ethnologueName
          }),
          (lang)-[:ethnologuePopulation {active: true}]->(ethnologuePopulation:Property {
            active: true,
            value: $ethnologuePopulation
          }),
          (lang)-[:organizationPopulation {active: true}]->(organizationPopulation:Property {
            active: true,
            value: $organizationPopulation
          }),
          (lang)-[:rodNumber {active: true}]->(rodNumber:Property {
            active: true,
            value: $rodNumber
          })
        RETURN
          lang.id as id,
          lang.createdAt as createdAt,
          name.value as name,
          user.canCreateLang as canCreateLang,
          user.canReadLangs as canReadLangs,
          displayName.value as displayName,
          beginFiscalYear.value as beginFiscalYear,
          ethnologueName.value as ethnologueName,
          ethnologuePopulation.value as ethnologuePopulation,
          organizationPopulation.value as organizationPopulation,
          rodNumber.value as rodNumber
      `,
        {
          token: token.token,
          name: input.name,
          displayName: input.displayName,
          beginFiscalYear: input.beginFiscalYear,
          ethnologueName: input.ethnologueName,
          ethnologuePopulation: input.ethnologuePopulation,
          organizationPopulation: input.organizationPopulation,
          rodNumber: input.rodNumber,
          id: generate(),
        },
      )
      .first();

    if (!result) {
      this.logger.error(
        `Could not create language: ${input.name} by ${token.userId}`,
      );
      throw new Error('Could not create language');
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      displayName: {
        value: result.displayName,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      beginFiscalYear: {
        value: result.beginFiscalYear,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      ethnologueName: {
        value: result.ethnologueName,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      ethnologuePopulation: {
        value: result.ethnologuePopulation,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      organizationPopulation: {
        value: result.organizationPopulation,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      rodNumber: {
        value: result.rodNumber,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      createdAt: result.createdAt,
    };
  }

  async readOne(langId: string, token: IRequestUser): Promise<Language> {
    this.logger.info(`Query readOne Language: id ${langId} by ${token.userId}`);
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
            active: true,
            id: $id
          })
          -[:name {active: true}]->
          (name:LangName {active: true}),
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
          user.canCreateLang as canCreateLang,
          user.canReadLangs as canReadLangs,
          displayName.value as displayName,
          beginFiscalYear.value as beginFiscalYear,
          ethnologueName.value as ethnologueName,
          ethnologuePopulation.value as ethnologuePopulation,
          organizationPopulation.value as organizationPopulation,
          rodNumber.value as rodNumber
        `,
        {
          id: langId,
          token: token.token,
        },
      )
      .first();

    if (!result) {
      this.logger.error(`Could not find language: ${langId} `);
      throw new NotFoundException('Could not find language');
    }

    if (!result.canCreateLang) {
      throw new Error('User does not have permission to create an language');
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      displayName: {
        value: result.displayName,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      beginFiscalYear: {
        value: result.beginFiscalYear,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      ethnologueName: {
        value: result.ethnologueName,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      ethnologuePopulation: {
        value: result.ethnologuePopulation,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      organizationPopulation: {
        value: result.organizationPopulation,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      rodNumber: {
        value: result.rodNumber,
        canRead: result.canReadLangs,
        canEdit: result.canCreateLang,
      },
      createdAt: result.createdAt,
    };
  }

  async update(input: UpdateLanguage, token: IRequestUser): Promise<Language> {
    throw new Error('Not implemented');
    this.logger.info(`mutation update language ${input.id} by ${token.userId}`);
    const language = await this.readOne(input.id, token);

    return this.propertyUpdater.updateProperties({
      token,
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

  async delete(id: string, token: IRequestUser): Promise<void> {
    this.logger.info(`mutation delete language: ${id} by ${token.userId}`);
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canCreateLang: true
          }),
          (lang:Language {
            active: true,
            id: $id
          })
        SET
          lang.active = false
        RETURN
          lang.id as id
        `,
        {
          id,
          token: token.token,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find language');
    }
  }

  async list(
    { page, count, sort, order, filter }: LanguageListInput,
    token: IRequestUser,
  ): Promise<LanguageListOutput> {
    this.logger.info(`query list Languages by ${token.userId}`);
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
          token: token.token,
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
