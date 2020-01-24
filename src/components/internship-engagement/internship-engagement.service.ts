import {
    CreateInternshipEngagementInput,
    CreateInternshipEngagementOutputDto,
    DeleteInternshipEngagementInput,
    DeleteInternshipEngagementOutputDto,
    ReadInternshipEngagementInput,
    ReadInternshipEngagementOutputDto,
    UpdateInternshipEngagementInput,
    UpdateInternshipEngagementOutputDto,
  } from './internship-engagement.dto';
  
  import { DatabaseService } from '../../core/database.service';
  import { Injectable } from '@nestjs/common';
  import { generate } from 'shortid';
  
  @Injectable()
  export class InternshipEngagementService {
    constructor(private readonly db: DatabaseService) {}
  
    async create(
      input: CreateInternshipEngagementInput,
    ): Promise<CreateInternshipEngagementOutputDto> {
      const response = new CreateInternshipEngagementOutputDto();
      const session = this.db.driver.session();
      const id = generate();
      await session
        .run(
          `MERGE (internshipEngagement:InternshipEngagement {active: true, owningOrg: "seedcompany", id: $id}) ON CREATE SET internshipEngagement.id = $id, internshipEngagement.timestamp = datetime() RETURN
          internshipEngagement.id as id,
          internshipEngagement.intern as intern,
          internshipEngagement.possibleStatuses as possibleStatuses,
          internshipEngagement.initialEndDate as initialEndDate,
          internshipEngagement.currentEndDate as currentEndDate,
          internshipEngagement.updatedAt as updatedAt
         `,
          {
            id,
            // intern: input.intern,
            // possibleStatuses: input.possibleStatuses,
            // initialEndDate: input.initialEndDate,
            // currentEndDate: input.currentEndDate,
            // updatedAt: input.updatedAt,
          },
        )
        .then(result => {
          response.internshipEngagement.id = result.records[0].get('id');
          response.internshipEngagement.intern = result.records[0].get('intern');
          response.internshipEngagement.possibleStatuses = result.records[0].get('possibleStatuses');
          response.internshipEngagement.initialEndDate = result.records[0].get('initialEndDate');
          response.internshipEngagement.currentEndDate = result.records[0].get('currentEndDate');
          response.internshipEngagement.updatedAt = result.records[0].get('updatedAt');
        })
        .catch(error => {
          console.log(error);
        })
        .then(() => session.close());
  
      return response;
    }
  
    async readOne(
      input: ReadInternshipEngagementInput,
    ): Promise<ReadInternshipEngagementOutputDto> {
      const response = new ReadInternshipEngagementOutputDto();
      const session = this.db.driver.session();
      await session
        .run(
          `MATCH (internshipEngagement:InternshipEngagement {active: true, owningOrg: "seedcompany"})
          WHERE internshipEngagement.id = "${input.id}"
          RETURN internshipEngagement.id as id,
          internshipEngagement.intern as intern,
          internshipEngagement.possibleStatuses as possibleStatuses,
          internshipEngagement.initialEndDate as initialEndDate,
          internshipEngagement.currentEndDate as currentEndDate,
          internshipEngagement.updatedAt as updatedAt`,
          {
            id: input.id,
          },
        )
        .then(result => {
          response.internshipEngagement.id = result.records[0].get('id');
          response.internshipEngagement.intern = result.records[0].get('intern');
          response.internshipEngagement.possibleStatuses = result.records[0].get('possibleStatuses');
          response.internshipEngagement.initialEndDate = result.records[0].get('initialEndDate');
          response.internshipEngagement.currentEndDate = result.records[0].get('currentEndDate');
          response.internshipEngagement.updatedAt = result.records[0].get('updatedAt');
        })
        .catch(error => {
          console.log(error);
        })
        .then(() => session.close());
  
      return response;
    }
  
    async update(
      input: UpdateInternshipEngagementInput,
    ): Promise<UpdateInternshipEngagementOutputDto> {
      const response = new UpdateInternshipEngagementOutputDto();
      const session = this.db.driver.session();
      await session
        .run(
          `MATCH (internshipEngagement:InternshipEngagement {active: true, owningOrg: "seedcompany", id: $id})
          SET internshipEngagement.intern = $intern
          // internshipEngagement.possibleStatuses = $possibleStatuses,
          // internshipEngagement.initialEndDate = $initialEndDate,
          // internshipEngagement.currentEndDate = $currentEndDate,
          // internshipEngagement.updatedAt = $updatedAt
            RETURN internshipEngagement.id as id,
            internshipEngagement.intern as intern,
            internshipEngagement.possibleStatuses as possibleStatuses,
            internshipEngagement.initialEndDate as initialEndDate,
            internshipEngagement.currentEndDate as currentEndDate,
            internshipEngagement.updatedAt as updatedAt`,
          {
            id: input.id,
            intern: input.intern,
            possibleStatuses: input.possibleStatuses,
            initialEndDate: input.initialEndDate,
            currentEndDate: input.currentEndDate,
            updatedAt: input.updatedAt,
          },
        )
        .then(result => {
          if (result.records.length > 0) {
            response.internshipEngagement.id = result.records[0].get('id');
            response.internshipEngagement.intern = result.records[0].get('intern');
            response.internshipEngagement.possibleStatuses = result.records[0].get('possibleStatuses');
            response.internshipEngagement.initialEndDate = result.records[0].get('initialEndDate');
            response.internshipEngagement.currentEndDate = result.records[0].get('currentEndDate');
            response.internshipEngagement.updatedAt = result.records[0].get('updatedAt');
          } else {
            response.internshipEngagement = null;
          }
        })
        .catch(error => {
          console.log(error);
        })
        .then(() => session.close());
  
      return response;
    }
  
    async delete(
      input: DeleteInternshipEngagementInput,
    ): Promise<DeleteInternshipEngagementOutputDto> {
      const response = new DeleteInternshipEngagementOutputDto();
      const session = this.db.driver.session();
      await session
        .run(
          `MATCH (internshipEngagement:InternshipEngagement {active: true, owningOrg: "seedcompany", id: $id})
           SET internshipEngagement.active = false RETURN internshipEngagement.id as id`,
          {
            id: input.id,
          },
        )
        .then(result => {
          response.internshipEngagement.id = result.records[0].get('id');
        })
        .catch(error => {
          console.log(error);
        })
        .then(() => session.close());
  
      return response;
    }
  }  