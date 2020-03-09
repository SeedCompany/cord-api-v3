import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { Sensitivity } from '../../common';
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
    @Logger('language:service') private readonly logger: ILogger
  ) {}

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
      `Query readOne Language: id ${langId} by ${session.userId}`
    );

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
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl1:ACL {canReadName: true})-[:toNode]->(lang)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl2:ACL {canReadDisplayName: true})-[:toNode]->(lang)-[:displayName {active: true}]->(displayName:Property {active: true})
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl3:ACL {canReadBeginFiscalYear: true})-[:toNode]->(lang)-[:beginFiscalYear {active: true}]->(beginFiscalYear:Property {active: true})
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl4:ACL {canReadEthnologueName: true})-[:toNode]->(lang)-[:ethnologueName {active: true}]->(ethnologueName:Property {active: true})
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl5:ACL {canReadEthnologuePopulation: true})-[:toNode]->(lang)-[:ethnologuePopulation {active: true}]->(ethnologuePopulation:Property {active: true})
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl6:ACL {canReadOrganizationPopulation: true})-[:toNode]->(lang)-[:organizationPopulation {active: true}]->(organizationPopulation:Property {active: true})
        WITH * OPTIONAL MATCH (user)<-[:member]-(acl7:ACL {canReadRodNumber: true})-[:toNode]->(lang)-[:rodNumber {active: true}]->(rodNumber:Property {active: true})
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
          rodNumber.value as rodNumber,
          acl1.canReadName as canReadName,
          acl2.canReadDisplayName as canReadDisplayName,
          acl3.canReadBeginFiscalYear as canReadBeginFiscalYear,
          acl4.canReadEthnologueName as canReadEthnologueName,
          acl5.canReadEthnologuePopulation as canReadEthnologuePopulation,
          acl6.canReadOrganizationPopulation as canReadOrganizationPopulation,
          acl7.canReadRodNumber as canReadRodNumber,
          acl1.canEditName as canEditName,
          acl2.canEditDisplayName as canEditDisplayName,
          acl3.canEditBeginFiscalYear as canEditBeginFiscalYear,
          acl4.canEditEthnologueName as canEditEthnologueName,
          acl5.canEditEthnologuePopulation as canEditEthnologuePopulation,
          acl6.canEditOrganizationPopulation as canEditOrganizationPopulation,
          acl7.canEditRodNumber as canEditRodNumber

        `,
        {
          id: langId,
          token: session.token,
        }
      )
      .first();

    if (!result) {
      this.logger.error(`Could not find language: ${langId} `);
      throw new NotFoundException('Could not find language');
    }

    if (!result.canReadLangs) {
      throw new Error('User does not have permission to read this language');
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
        canRead: result.canReadDisplayName,
        canEdit: result.canEditDisplayName,
      },
      beginFiscalYear: {
        value: result.beginFiscalYear,
        canRead: result.canReadBeginFiscalYear,
        canEdit: result.canEditBeginFiscalYear,
      },
      ethnologueName: {
        value: result.ethnologueName,
        canRead: result.canReadEthnologueName,
        canEdit: result.canEditEthnologueName,
      },
      ethnologuePopulation: {
        value: result.ethnologuePopulation,
        canRead: result.canReadEthnologuePopulation,
        canEdit: result.canEditEthnologuePopulation,
      },
      organizationPopulation: {
        value: result.organizationPopulation,
        canRead: result.canReadOrganizationPopulation,
        canEdit: result.canEditOrganizationPopulation,
      },
      rodNumber: {
        value: result.rodNumber,
        canRead: result.canReadRodNumber,
        canEdit: result.canEditRodNumber,
      },
      sensitivity: Sensitivity.High, // TODO
      createdAt: result.createdAt,
    };
  }

  async update(input: UpdateLanguage, session: ISession): Promise<Language> {
    throw new Error('Not implemented');
    this.logger.info(
      `mutation update language ${input.id} by ${session.userId}`
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
    session: ISession
  ): Promise<LanguageListOutput> {
    const result = await this.propertyUpdater.list<Language>({
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
}
