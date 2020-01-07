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
} from './language.dto';

@Injectable()
export class LanguageService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    input: CreateLanguageInput,
  ): Promise<CreateLanguageOutputDto> {
    const response = new CreateLanguageOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (lang:Language {active: true, owningOrg: "seedcompany", name: $name}) ON CREATE SET lang.id = $id, lang.timestamp = datetime() RETURN lang.id as id, lang.name as name',
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

  async readOne(
    input: ReadLanguageInput,
  ): Promise<ReadLanguageOutputDto> {
    const response = new ReadLanguageOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (lang:Language {active: true, owningOrg: "seedcompany"}) WHERE lang.id = $id RETURN lang.id as id, lang.name as name',
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
        'MATCH (lang:Language {active: true, owningOrg: "seedcompany", id: $id}) SET lang.name = $name RETURN lang.id as id, lang.name as name',
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
        'MATCH (lang:Language {active: true, owningOrg: "seedcompany", id: $id}) SET lang.active = false RETURN lang.id as id',
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
}
