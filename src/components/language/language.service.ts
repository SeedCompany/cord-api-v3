import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import {
  CreateLanguage,
  Language,
  LanguageListInput,
  LanguageListOutput,
  UpdateLanguage,
} from './dto';

@Injectable()
export class LanguageService {
  constructor(private readonly db: Connection) {}

  async create(input: CreateLanguage, token: string): Promise<Language> {
    throw new Error('Not implemented.');

    const result = await this.db
      .query()
      .raw(
        `
        MERGE (lang:Language {active: true, name: $name})
        ON CREATE SET lang.id = $id, lang.timestamp = datetime()
        `,
        {
          id: generate(),
        },
      )
      .first();

    if (!result) {
      throw new Error('Could not create language');
    }
  }

  async readOne(id: string, token: string): Promise<Language> {
    throw new Error('Not implemented.');

    const result = await this.db
      .query()
      .raw(
        `
          MATCH (lang:Language {active: true})
          WHERE lang.id = $id
          RETURN lang.id as id, lang.name as name
        `,
        {
          id,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find language');
    }
  }

  async update(input: UpdateLanguage, token: string): Promise<Language> {
    throw new Error('Not implemented.');

    const result = await this.db
      .query()
      .raw(
        `
          MATCH (lang:Language {active: true, id: $id})
          SET lang.name = $name
          RETURN lang.id as id, lang.name as name
        `,
        {},
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find language');
    }
  }

  async delete(id: string, token: string): Promise<void> {
    throw new Error('Not implemented.');

    const result = await this.db
      .query()
      .raw(
        `
          MATCH (lang:Language {active: true, id: $id})
          SET lang.active = false
          RETURN lang.id as id
        `,
        {},
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find language');
    }
  }

  async list(
    { page, count, sort, order, filter }: LanguageListInput,
    token: string,
  ): Promise<LanguageListOutput> {
    throw new Error('Not implemented.');

    const result = await this.db
      .query()
      .raw(
        `
          MATCH (language:Language {active: true})
          WHERE language.name CONTAINS $filter
          RETURN language.id as id, language.name as name
          ORDER BY language.${sort} ${order}
          SKIP $skip LIMIT $count
        `,
        {
          filter: filter.name,
          skip: (page - 1) * count,
          count,
        },
      )
      .run();
  }
}
