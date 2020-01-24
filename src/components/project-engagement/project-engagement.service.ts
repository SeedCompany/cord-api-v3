import {
  CreateProjectEngagementInput,
  CreateProjectEngagementOutputDto,
  DeleteProjectEngagementInput,
  DeleteProjectEngagementOutputDto,
  ReadProjectEngagementInput,
  ReadProjectEngagementOutputDto,
  UpdateProjectEngagementInput,
  UpdateProjectEngagementOutputDto,
} from './project-engagement.dto';

import { DatabaseService } from '../../core/database.service';
import { Injectable } from '@nestjs/common';
import { generate } from 'shortid';

@Injectable()
export class ProjectEngagementService {
  constructor(private readonly db: DatabaseService) {
  }

  async create(
    input: CreateProjectEngagementInput,
  ): Promise<CreateProjectEngagementOutputDto> {
    const response = new CreateProjectEngagementOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `MATCH (language:Language {name: "${input.languageName}"}) 
        CREATE (projectEngagement { id: "${id}", active: true, timestamp: datetime()})-[:language {active: true, timestamp: datetime()}]->(l)
        RETURN projectEngagement.id as id, language.name as languageName
        `,
        {
          id,
          languageName: input.languageName,
        },
      )
      .then(result => {
        console.log(JSON.stringify(result.records))
        response.projectEngagement.id = result.records[0].get('id');
        response.projectEngagement.languageName = result.records[0].get('languageName');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadProjectEngagementInput,
  ): Promise<ReadProjectEngagementOutputDto> {
    const response = new ReadProjectEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (projectEngagement:ProjectEngagement {active: true, owningOrg: "seedcompany"}) WHERE projectEngagement.id = $id RETURN projectEngagement.id as id, projectEngagement.name as name',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.projectEngagement.id = result.records[0].get('id');
        response.projectEngagement.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateProjectEngagementInput): Promise<UpdateProjectEngagementOutputDto> {
    const response = new UpdateProjectEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (projectEngagement:ProjectEngagement {active: true, owningOrg: "seedcompany", id: $id}) SET projectEngagement.name = $name RETURN projectEngagement.id as id, projectEngagement.name as name',
        {
          id: input.id,
          name: input.name,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.projectEngagement.id = result.records[0].get('id');
          response.projectEngagement.name = result.records[0].get('name');
        } else {
          response.projectEngagement = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteProjectEngagementInput): Promise<DeleteProjectEngagementOutputDto> {
    const response = new DeleteProjectEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (projectEngagement:ProjectEngagement {active: true, owningOrg: "seedcompany", id: $id}) SET projectEngagement.active = false RETURN projectEngagement.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.projectEngagement.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
