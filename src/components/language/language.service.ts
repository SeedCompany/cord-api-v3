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

    const result = await this.propertyUpdater.readProperties({
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

    return result as Language;
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
