import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateInternshipOutputDto,
  ReadInternshipOutputDto,
  UpdateInternshipOutputDto,
  DeleteInternshipOutputDto,
  CreateInternshipInput,
  ReadInternshipInput,
  UpdateInternshipInput,
  DeleteInternshipInput,
} from './internship.dto';

@Injectable()
export class InternshipService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateInternshipInput): Promise<CreateInternshipOutputDto> {
    const response = new CreateInternshipOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `MERGE (internship:Internship {active: true, name: $name, owningOrg: "seedcompany"}) ON CREATE SET internship.id = $id, internship.timestamp = datetime() RETURN
        internship.id as id,
        internship.name as name,
        internship.deptId as deptId,
        internship.status as status,
        internship.location as location,
        internship.publicLocation as publicLocation,
        internship.mouStart as mouStart,
        internship.mouEnd as mouEnd,
        internship.partnerships as partnerships,
        internship.sensitivity as sensitivity,
        internship.team as team,
        internship.budgets as budgets,
        internship.estimatedSubmission as estimatedSubmission,
        internship.engagements as engagements
       `,
        {
          id,
          name: input.name,
          // deptId: input.deptId,
          // status: input.status,
          // location: input.location,
          // publicLocation: input.publicLocation,
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
        response.internship.id = result.records[0].get('id');
        response.internship.name = result.records[0].get('name');
        response.internship.deptId = result.records[0].get('deptId');
        response.internship.status = result.records[0].get('status');
        response.internship.location = result.records[0].get('location');
        response.internship.publicLocation = result.records[0].get(
          'publicLocation',
        );
        response.internship.mouStart = result.records[0].get('mouStart');
        response.internship.mouEnd = result.records[0].get('mouEnd');
        response.internship.partnerships = result.records[0].get('partnerships');
        response.internship.sensitivity = result.records[0].get('sensitivity');
        response.internship.team = result.records[0].get('team');
        response.internship.budgets = result.records[0].get('budgets');
        response.internship.estimatedSubmission = result.records[0].get(
          'estimatedSubmission',
        );
        response.internship.engagements = result.records[0].get('engagements');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(input: ReadInternshipInput): Promise<ReadInternshipOutputDto> {
    const response = new ReadInternshipOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (internship:Internship {active: true, owningOrg: "seedcompany"})
        WHERE internship.id = "${input.id}"
        RETURN internship.id as id,
        internship.name as name,
        internship.deptId as deptId,
        internship.status as status,
        internship.location as location,
        internship.publicLocation as publicLocation,
        internship.mouStart as mouStart,
        internship.mouEnd as mouEnd,
        internship.languages as languages,
        internship.partnerships as partnerships,
        internship.sensitivity as sensitivity,
        internship.team as team,
        internship.budgets as budgets,
        internship.estimatedSubmission as estimatedSubmission,
        internship.engagements as engagements`,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.internship.id = result.records[0].get('id');
        response.internship.name = result.records[0].get('name');
        response.internship.deptId = result.records[0].get('deptId');
        response.internship.status = result.records[0].get('status');
        response.internship.location = result.records[0].get('location');
        response.internship.publicLocation = result.records[0].get(
          'publicLocation',
        );
        response.internship.mouStart = result.records[0].get('mouStart');
        response.internship.mouEnd = result.records[0].get('mouEnd');
        response.internship.partnerships = result.records[0].get('partnerships');
        response.internship.sensitivity = result.records[0].get('sensitivity');
        response.internship.team = result.records[0].get('team');
        response.internship.budgets = result.records[0].get('budgets');
        response.internship.estimatedSubmission = result.records[0].get(
          'estimatedSubmission',
        );
        response.internship.engagements = result.records[0].get('engagements');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateInternshipInput): Promise<UpdateInternshipOutputDto> {
    const response = new UpdateInternshipOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (internship:Internship {active: true, owningOrg: "seedcompany", id: $id})
        SET internship.name = $name,
        internship.deptId = $deptId,
        internship.status = $status,
        internship.location = $location,
        internship.publicLocation = $publicLocation,
        internship.mouStart = $mouStart,
        internship.mouEnd = $mouEnd,
        internship.partnerships = $partnerships,
        internship.sensitivity = $sensitivity,
        internship.team = $team,
        internship.budgets = $budgets,
        internship.estimatedSubmission = $estimatedSubmission,
        internship.engagements = $engagements
          RETURN internship.id as id,
          internship.name as name,
          internship.deptId as deptId,
          internship.status as status,
          internship.location as location,
          internship.publicLocation as publicLocation,
          internship.mouStart as mouStart,
          internship.mouEnd as mouEnd,
          internship.partnerships as partnerships,
          internship.sensitivity as sensitivity,
          internship.team as team,
          internship.budgets as budgets,
          internship.estimatedSubmission as estimatedSubmission,
          internship.engagements as engagements`,
        {
          id: input.id,
          name: input.name,
          deptId: input.deptId,
          status: input.status,
          location: input.locationId,
          publicLocation: input.publicLocation,
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
          response.internship.id = result.records[0].get('id');
          response.internship.name = result.records[0].get('name');
          response.internship.deptId = result.records[0].get('deptId');
          response.internship.status = result.records[0].get('status');
          response.internship.location = result.records[0].get('location');
          response.internship.publicLocation = result.records[0].get(
            'publicLocation',
          );
          response.internship.mouStart = result.records[0].get('mouStart');
          response.internship.mouEnd = result.records[0].get('mouEnd');
          response.internship.partnerships = result.records[0].get('partnerships');
          response.internship.sensitivity = result.records[0].get('sensitivity');
          response.internship.team = result.records[0].get('team');
          response.internship.budgets = result.records[0].get('budgets');
          response.internship.estimatedSubmission = result.records[0].get(
            'estimatedSubmission',
          );
          response.internship.engagements = result.records[0].get('engagements');
        } else {
          response.internship = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteInternshipInput): Promise<DeleteInternshipOutputDto> {
    const response = new DeleteInternshipOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (internship:Internship {active: true, owningOrg: "seedcompany", id: $id}) SET internship.active = false RETURN internship.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.internship.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
