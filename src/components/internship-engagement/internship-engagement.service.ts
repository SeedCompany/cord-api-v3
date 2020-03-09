import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { DeprecatedDBService } from '../../core/deprecated-database.service';
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

@Injectable()
export class InternshipEngagementService {
  constructor(private readonly db: DeprecatedDBService) {}

  async create(
    input: CreateInternshipEngagementInput
  ): Promise<CreateInternshipEngagementOutputDto> {
    const response = new CreateInternshipEngagementOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `MATCH (intern:User {id: $internId}),
          (intern)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
          (intern)-[:displayLastName {active: true}]->(displayLastName:Property {active: true}),
          (intern)-[:email {active: true}]->(email:Property {active: true}),
          (intern)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
          (intern)-[:realLastName {active: true}]->(realLastName:Property {active: true})
        CREATE (internshipEngagement:InternshipEngagement
          {id: $id,
          active: true,
          timestamp: datetime(),
          owningOrg: "seedcompany",
          initialEndDate: "$initialEndDate",
          currentEndDate: "$currentEndDate"
          })
          -[:intern {active: true, timestamp: datetime()}]->(intern)
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
          internId: input.internId,
          initialEndDate: input.initialEndDate,
          currentEndData: input.currentEndDate,
        }
      )
      .then(result => {
        response.internshipEngagement.id = result.records[0].get('id');
        response.intern = {
          displayFirstName: result.records[0].get('displayFirstName'),
          displayLastName: result.records[0].get('displayLastName'),
          realFirstName: result.records[0].get('realFirstName'),
          realLastName: result.records[0].get('realLastName'),
          email: result.records[0].get('email'),
          id: result.records[0].get('userId'),
          createdAt: DateTime.local(),
          timezone: {
            value: undefined,
            canRead: true,
            canEdit: true,
          },
          phone: {
            value: undefined,
            canRead: true,
            canEdit: true,
          },
          bio: {
            value: undefined,
            canRead: true,
            canEdit: true,
          },
        };
        response.internshipEngagement.initialEndDate = result.records[0].get(
          'initialEndDate'
        );
        response.internshipEngagement.currentEndDate = result.records[0].get(
          'currentEndDate'
        );
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadInternshipEngagementInput
  ): Promise<ReadInternshipEngagementOutputDto> {
    const response = new ReadInternshipEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (internshipEngagement:InternshipEngagement {id: "${input.id}", active: true, owningOrg: "seedcompany"})
        -[:intern {active: true}]
        ->(intern:User {active: true}),
        (intern)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
        (intern)-[:displayLastName {active: true}]->(displayLastName:Property {active: true}),
        (intern)-[:email {active: true}]->(email:Property {active: true}),
        (intern)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
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
          id: input.id,
        }
      )
      .then(result => {
        response.internshipEngagement.id = result.records[0].get('id');
        response.intern = {
          displayFirstName: result.records[0].get('displayFirstName'),
          displayLastName: result.records[0].get('displayLastName'),
          realFirstName: result.records[0].get('realFirstName'),
          realLastName: result.records[0].get('realLastName'),
          email: result.records[0].get('email'),
          id: result.records[0].get('userId'),
          createdAt: DateTime.local(),
          timezone: {
            value: undefined,
            canRead: true,
            canEdit: true,
          },
          phone: {
            value: undefined,
            canRead: true,
            canEdit: true,
          },
          bio: {
            value: undefined,
            canRead: true,
            canEdit: true,
          },
        };
        response.internshipEngagement.initialEndDate = result.records[0].get(
          'initialEndDate'
        );
        response.internshipEngagement.currentEndDate = result.records[0].get(
          'currentEndDate'
        );
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(
    input: UpdateInternshipEngagementInput
  ): Promise<UpdateInternshipEngagementOutputDto> {
    const response = new UpdateInternshipEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH
          (internshipEngagement:InternshipEngagement {active: true, owningOrg: "seedcompany", id: $id})
          -[:intern {active: true}]->(intern:User {active: true}),
          (intern)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
          (intern)-[:displayLastName {active: true}]->(displayLastName:Property {active: true}),
          (intern)-[:email {active: true}]->(email:Property {active: true}),
          (intern)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
          (intern)-[:realLastName {active: true}]->(realLastName:Property {active: true})
        SET
          internshipEngagement.initialEndDate = $initialEndDate,
          internshipEngagement.currentEndDate = $currentEndDate
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
          initialEndDate: input.initialEndDate,
          currentEndDate: input.currentEndDate,
        }
      )
      .then(result => {
        if (result.records.length > 0) {
          response.intern = {
            displayFirstName: result.records[0].get('displayFirstName'),
            displayLastName: result.records[0].get('displayLastName'),
            realFirstName: result.records[0].get('realFirstName'),
            realLastName: result.records[0].get('realLastName'),
            email: result.records[0].get('email'),
            id: result.records[0].get('userId'),
            createdAt: DateTime.local(),
            timezone: {
              value: undefined,
              canRead: true,
              canEdit: true,
            },
            phone: {
              value: undefined,
              canRead: true,
              canEdit: true,
            },
            bio: {
              value: undefined,
              canRead: true,
              canEdit: true,
            },
          };

          response.internshipEngagement = {
            id: result.records[0].get('id'),
            initialEndDate: result.records[0].get('initialEndDate'),
            currentEndDate: result.records[0].get('currentEndDate'),
          };
        } else {
          throw new Error('Could not update internship.');
        }
      })
      .catch(error => {
        console.log(error);
        throw error;
      })
      .then(() => session.close());

    return response;
  }

  async delete(
    input: DeleteInternshipEngagementInput
  ): Promise<DeleteInternshipEngagementOutputDto> {
    const response = new DeleteInternshipEngagementOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (internshipEngagement:InternshipEngagement {active: true, owningOrg: "seedcompany", id: $id})
           SET internshipEngagement.active = false RETURN internshipEngagement.id as id`,
        {
          id: input.id,
        }
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
