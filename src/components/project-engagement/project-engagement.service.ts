import { Injectable } from '@nestjs/common';
import { generate } from 'shortid';
import { DeprecatedDBService } from '../../core/deprecated-database.service';
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

@Injectable()
export class ProjectEngagementService {
  constructor(private readonly db: DeprecatedDBService) {}

  async create(
    input: CreateProjectEngagementInput
  ): Promise<CreateProjectEngagementOutputDto> {
    const response = new CreateProjectEngagementOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `MATCH (language:Language {name: "${input.languageName}"})
        CREATE (projectEngagement:ProjectEngagement { id: "${id}", active: true, timestamp: datetime(), owningOrg: "seedcompany"})-[:language {active: true, timestamp: datetime()}]->(language)
        RETURN projectEngagement.id as id, language.name as languageName
        `,
        {
          id,
          languageName: input.languageName,
        }
      )
      .then(result => {
        response.projectEngagement.id = result.records[0].get('id');
        response.projectEngagement.languageName = result.records[0].get(
          'languageName'
        );
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadProjectEngagementInput
  ): Promise<ReadProjectEngagementOutputDto> {
    const response = new ReadProjectEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (projectEngagement:ProjectEngagement {active: true, owningOrg: "seedcompany"}) -[:language]-> (language:Language)WHERE projectEngagement.id = $id RETURN projectEngagement.id as id, language.name as languageName`,
        {
          id: input.id,
        }
      )
      .then(result => {
        response.projectEngagement.id = result.records[0].get('id');
        response.projectEngagement.languageName = result.records[0].get(
          'languageName'
        );
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(
    input: UpdateProjectEngagementInput
  ): Promise<UpdateProjectEngagementOutputDto> {
    const response = new UpdateProjectEngagementOutputDto();
    const session = this.db.driver.session();

    await session
      .run(
        `MATCH (projectEngagement:ProjectEngagement {active: true, owningOrg: "seedcompany", id: $id})
        SET projectEngagement.initialEndDate = $initialEndDate, projectEngagement.currentEndDate = $currentEndDate
        RETURN projectEngagement.id as id,
        projectEngagement.initialEndDate as initialEndDate,
        projectEngagement.currentEndDate as currentEndDate`,
        {
          id: input.id,
          initialEndDate: input.initialEndDate,
          currentEndDate: input.currentEndDate,
        }
      )
      .then(result => {
        if (result.records.length > 0) {
          response.projectEngagement = {
            id: result.records[0].get('id'),
            initialEndDate: result.records[0].get('initialEndDate'),
            currentEndDate: result.records[0].get('currentEndDate'),
          };
        } else {
          throw new Error('Could not update project engagement.');
        }
      })
      .catch(error => {
        console.log(error);
        throw new Error(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(
    input: DeleteProjectEngagementInput
  ): Promise<DeleteProjectEngagementOutputDto> {
    const response = new DeleteProjectEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (projectEngagement:ProjectEngagement {active: true, owningOrg: "seedcompany", id: $id}) SET projectEngagement.active = false RETURN projectEngagement.id as id',
        {
          id: input.id,
        }
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
