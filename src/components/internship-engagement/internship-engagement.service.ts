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
        `MATCH (intern:User {name: "$internName"})
        CREATE (internshipEngagement:InternshipEngagement
          {id: "$id",
          active: true,
          timestamp: datetime()})
          -[:intern {active: true, timestamp: datetime()}]->(intern)
          (intern)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true})
          (intern)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
          (intern)-[:email {active: true}]->(email:Property {active: true})
          (intern)-[:realFirstName {active: true}]->(realFirstName:Property {active: true})
          (intern)-[:realLastName {active: true}]->(realLastName:Property {active: true})
        RETURN internshipEngagement.id as id,
          email.value as email,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          intern.id as userId,
          internshipEngagement.initialEndDate as initialEndDate,
          internshipEngagement.currentEndDate as currentEndDate
         `,
        {
          id,
          internName: input.internName,
          initialEndDate: input.initialEndDate,
          currentEndData: input.currentEndDate,
        },
      )
      .then(result => {
        console.log(JSON.stringify(result.records));
        response.internshipEngagement.id = result.records[0].get('id');
        response.intern.displayFirstName = result.records[0].get(
          'displayFirstName',
        );
        response.intern.displayLastName = result.records[0].get(
          'displayLastName',
        );
        response.intern.realFirstName = result.records[0].get('realFirstName');
        response.intern.realLastName = result.records[0].get('realLastName');
        response.intern.email = result.records[0].get('email');
        response.intern.id = result.records[0].get('userId');
        response.internshipEngagement.initialEndDate = result.records[0].get(
          'initialEndDate',
        );
        response.internshipEngagement.currentEndDate = result.records[0].get(
          'currentEndDate',
        );
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
        -[:intern {active: true}]
        ->(intern:User {active: true})
        (intern)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true})
        (intern)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
        (intern)-[:email {active: true}]->(email:Property {active: true})
        (intern)-[:realFirstName {active: true}]->(realFirstName:Property {active: true})
        (intern)-[:realLastName {active: true}]->(realLastName:Property {active: true})
          WHERE internshipEngagement.id = "$id"
          RETURN internshipEngagement.id as id,
          email.value as email,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          intern.id as userId,
          internshipEngagement.initialEndDate as initialEndDate,
          internshipEngagement.currentEndDate as currentEndDate
          `,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.internshipEngagement.id = result.records[0].get('id');
        response.intern.displayFirstName = result.records[0].get(
          'displayFirstName',
        );
        response.intern.displayLastName = result.records[0].get(
          'displayLastName',
        );
        response.intern.realFirstName = result.records[0].get('realFirstName');
        response.intern.realLastName = result.records[0].get('realLastName');
        response.intern.email = result.records[0].get('email');
        response.intern.id = result.records[0].get('userId');
        response.internshipEngagement.initialEndDate = result.records[0].get(
          'initialEndDate',
        );
        response.internshipEngagement.currentEndDate = result.records[0].get(
          'currentEndDate',
        );
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
          SET
           internshipEngagement.initialEndDate = $initialEndDate,
           internshipEngagement.currentEndDate = $currentEndDate,
           timestamp = datetime()
            RETURN internshipEngagement.id as id,
            internshipEngagement.intern as intern,
            internshipEngagement.initialEndDate as initialEndDate,
            internshipEngagement.currentEndDate as currentEndDate`,
        {
          id: input.id,
          initialEndDate: input.initialEndDate,
          currentEndDate: input.currentEndDate,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.internshipEngagement.id = result.records[0].get('id');
          response.internshipEngagement.initialEndDate = result.records[0].get(
            'initialEndDate',
          );
          response.internshipEngagement.currentEndDate = result.records[0].get(
            'currentEndDate',
          );
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
