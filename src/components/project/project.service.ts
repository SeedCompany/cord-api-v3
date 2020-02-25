import { Injectable } from '@nestjs/common';
import { ISession } from '../auth';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateProjectOutputDto,
  ReadProjectOutputDto,
  UpdateProjectOutputDto,
  DeleteProjectOutputDto,
  CreateProjectInput,
  ReadProjectInput,
  UpdateProjectInput,
  DeleteProjectInput,
} from './project.dto';

import { Project, ProjectListInput, ProjectListOutput } from './dto';
@Injectable()
export class ProjectService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateProjectInput): Promise<CreateProjectOutputDto> {
    const response = new CreateProjectOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `MERGE (project:Project {active: true, name: $name, owningOrg: "seedcompany"}) ON CREATE SET project.id = $id, project.timestamp = datetime() RETURN
        project.id as id,
        project.name as name,
        project.deptId as deptId,
        project.status as status,
        project.location as location,
        project.mouStart as mouStart,
        project.mouEnd as mouEnd,
        project.partnerships as partnerships,
        project.sensitivity as sensitivity,
        project.team as team,
        project.budgets as budgets,
        project.estimatedSubmission as estimatedSubmission,
        project.engagements as engagements
       `,
        {
          id,
          name: input.name,
          // deptId: input.deptId,
          // status: input.status,
          // location: input.location,
          // mouStart: input.mouStart,
          // mouEnd: input.mouEnd,
          // partnerships: input.partnerships,
          // sensitivity: input.sensitivity,
          // team: input.team,
          // budgets: input.budgets,
          // estimatedSubmission: input.estimatedSubmission,
          // engagements: input.engagements,
        },
      )
      .then(result => {
        response.project.id = result.records[0].get('id');
        response.project.name = result.records[0].get('name');
        response.project.deptId = result.records[0].get('deptId');
        response.project.status = result.records[0].get('status');
        response.project.location = result.records[0].get('location');
        response.project.publicLocation = result.records[0].get(
          'publicLocation',
        );
        response.project.mouStart = result.records[0].get('mouStart');
        response.project.mouEnd = result.records[0].get('mouEnd');
        response.project.partnerships = result.records[0].get('partnerships');
        response.project.sensitivity = result.records[0].get('sensitivity');
        response.project.team = result.records[0].get('team');
        response.project.budgets = result.records[0].get('budgets');
        response.project.estimatedSubmission = result.records[0].get(
          'estimatedSubmission',
        );
        response.project.engagements = result.records[0].get('engagements');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(input: ReadProjectInput): Promise<ReadProjectOutputDto> {
    const response = new ReadProjectOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (project:Project {active: true, owningOrg: "seedcompany"})
        WHERE project.id = "${input.id}"
        RETURN project.id as id,
        project.name as name,
        project.deptId as deptId,
        project.status as status,
        project.location as location,
        project.publicLocation as publicLocation,
        project.mouStart as mouStart,
        project.mouEnd as mouEnd,
        project.languages as languages,
        project.partnerships as partnerships,
        project.sensitivity as sensitivity,
        project.team as team,
        project.budgets as budgets,
        project.estimatedSubmission as estimatedSubmission,
        project.engagements as engagements`,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.project.id = result.records[0].get('id');
        response.project.name = result.records[0].get('name');
        response.project.deptId = result.records[0].get('deptId');
        response.project.status = result.records[0].get('status');
        response.project.location = result.records[0].get('location');
        response.project.publicLocation = result.records[0].get(
          'publicLocation',
        );
        response.project.mouStart = result.records[0].get('mouStart');
        response.project.mouEnd = result.records[0].get('mouEnd');
        response.project.partnerships = result.records[0].get('partnerships');
        response.project.sensitivity = result.records[0].get('sensitivity');
        response.project.team = result.records[0].get('team');
        response.project.budgets = result.records[0].get('budgets');
        response.project.estimatedSubmission = result.records[0].get(
          'estimatedSubmission',
        );
        response.project.engagements = result.records[0].get('engagements');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateProjectInput): Promise<UpdateProjectOutputDto> {
    const response = new UpdateProjectOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (project:Project {active: true, owningOrg: "seedcompany", id: $id})
        SET project.name = $name,
        project.deptId = $deptId,
        project.status = $status,
        project.location = $location,
        project.publicLocation = $publicLocation,
        project.mouStart = $mouStart,
        project.mouEnd = $mouEnd,
        project.partnerships = $partnerships,
        project.sensitivity = $sensitivity,
        project.team = $team,
        project.budgets = $budgets,
        project.estimatedSubmission = $estimatedSubmission,
        project.engagements = $engagements
          RETURN project.id as id,
          project.name as name,
          project.deptId as deptId,
          project.status as status,
          project.location as location,
          project.publicLocation as publicLocation,
          project.mouStart as mouStart,
          project.mouEnd as mouEnd,
          project.partnerships as partnerships,
          project.sensitivity as sensitivity,
          project.team as team,
          project.budgets as budgets,
          project.estimatedSubmission as estimatedSubmission,
          project.engagements as engagements`,
        {
          id: input.id,
          name: input.name,
          deptId: input.deptId,
          status: input.status,
          location: input.locationId,
          mouStart: input.mouStart,
          mouEnd: input.mouEnd,
          partnerships: input.partnerships,
          sensitivity: input.sensitivity,
          team: input.team,
          budgets: input.budgets,
          estimatedSubmission: input.estimatedSubmission,
          engagements: input.engagements,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.project = {
            id: result.records[0].get('id'),
            name: result.records[0].get('name'),
            deptId: result.records[0].get('deptId'),
            status: result.records[0].get('status'),
            location: result.records[0].get('location'),
            publicLocation: result.records[0].get(
              'publicLocation',
            ),
            mouStart: result.records[0].get('mouStart'),
            mouEnd: result.records[0].get('mouEnd'),
            partnerships: result.records[0].get('partnerships'),
            sensitivity: result.records[0].get('sensitivity'),
            team: result.records[0].get('team'),
            budgets: result.records[0].get('budgets'),
            estimatedSubmission: result.records[0].get(
              'estimatedSubmission',
            ),
            engagements: result.records[0].get('engagements'),
  
          }
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

  async delete(input: DeleteProjectInput): Promise<DeleteProjectOutputDto> {
    const response = new DeleteProjectOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (project:Project {active: true, owningOrg: "seedcompany", id: $id}) SET project.active = false RETURN project.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.project.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async list(
    { page, count, sort, order, filter }: ProjectListInput,
    { token }: ISession,
  ): Promise<ProjectListOutput> {
    const result = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (user:User {
          canReadOrgs: true
        }),
        (proj:Project {
          active: true
        })
//      WHERE
//        proj.name CONTAINS $filter
      WITH count(proj) as projs, user
      MATCH
        (proj:Project {
          active: true
        })
        -[:name {active: true}]->
        (name:Property {
          active: true
        })
      RETURN
        proj.id as id,
        proj.createdAt as createdAt,
        name.value as name,
        user.canCreateOrg as canCreateOrg,
        user.canReadOrgs as canReadOrgs,
        projs as total
      ORDER BY proj.${sort} ${order}
      SKIP $skip
      LIMIT $count
      `,
        {
          // filter: filter.name, // TODO Handle no filter
          skip: (page - 1) * count,
          count,
          token,
        },
      )
      .run();

    const items = result.map<Project>(row => ({
      id: row.id,
      createdAt: row.createdAt,
      name: {
        value: row.name,
        canRead: row.canReadOrgs,
        canEdit: row.canCreateOrg,
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
