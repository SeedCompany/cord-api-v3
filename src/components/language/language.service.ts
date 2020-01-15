import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateLanguageInput,
  CreateLanguageOutputDto,
  ReadLanguageOutputDto,
  UpdateLanguageOutputDto,
  DeleteLanguageOutputDto,
  ReadLanguageInput,
  UpdateLanguageInput,
  DeleteLanguageInput,
  ListLanguagesInput,
  ListLanguagesOutputDto,
} from './language.dto';
import { Language } from './language';

@Injectable()
export class LanguageService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateLanguageInput): Promise<CreateLanguageOutputDto> {
    const response = new CreateLanguageOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (lang:Language {active: true, name: $name}) ON CREATE SET lang.id = $id, lang.timestamp = datetime() RETURN lang.id as id, lang.name as name',
        {
          id,
          name: input.name,
        },
      )
      .then(result => {
        response.language.id = result.records[0].get('id');
        response.language.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(input: ReadLanguageInput): Promise<ReadLanguageOutputDto> {
    const response = new ReadLanguageOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (lang:Language {active: true}) WHERE lang.id = $id RETURN lang.id as id, lang.name as name',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.language.id = result.records[0].get('id');
        response.language.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateLanguageInput): Promise<UpdateLanguageOutputDto> {
    const response = new UpdateLanguageOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (lang:Language {active: true, id: $id}) SET lang.name = $name RETURN lang.id as id, lang.name as name',
        {
          id: input.id,
          name: input.name,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.language.id = result.records[0].get('id');
          response.language.name = result.records[0].get('name');
        } else {
          response.language = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteLanguageInput): Promise<DeleteLanguageOutputDto> {
    const response = new DeleteLanguageOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (lang:Language {active: true, id: $id}) SET lang.active = false RETURN lang.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.language.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async queryLanguages(
    query: ListLanguagesInput,
  ): Promise<ListLanguagesOutputDto> {
    const response = new ListLanguagesOutputDto();
    const session = this.db.driver.session();
    const skipIt = query.page * query.count;

    const result = await session.run(
      `MATCH (language:Language {active: true}) WHERE language.name CONTAINS $filter RETURN language.id as id, language.name as name ORDER BY ${query.sort} ${query.order} SKIP $skip LIMIT $count`,
      {
        filter: query.filter,
        skip: skipIt,
        count: query.count,
        sort: query.sort,
        order: query.order,
      },
    );

    session.close();

    response.languages = result.records.map(record => {
      const org = new Language();
      org.id = record.get('id');
      org.name = record.get('name');
      return org;
    });

    return response;
  }
}
