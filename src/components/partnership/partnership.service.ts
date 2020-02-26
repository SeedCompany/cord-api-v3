import {
  CreatePartnershipInput,
  CreatePartnershipOutputDto,
  DeletePartnershipInput,
  DeletePartnershipOutputDto,
  ListPartnershipsInput,
  ListPartnershipsOutputDto,
  ReadPartnershipInput,
  ReadPartnershipOutputDto,
  UpdatePartnershipInput,
  UpdatePartnershipOutputDto,
} from './partnership.dto';

import { DatabaseService } from '../../core/database.service';
import { Injectable } from '@nestjs/common';
import { generate } from 'shortid';
import { Partnership } from './partnership';

@Injectable()
export class PartnershipService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    input: CreatePartnershipInput,
  ): Promise<CreatePartnershipOutputDto> {
    const response = new CreatePartnershipOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `MERGE (partnership:Partnership {active: true, owningOrg: "seedcompany", id: $id}) ON CREATE SET partnership.id = $id, partnership.timestamp = datetime() RETURN
        partnership.id as id,
        partnership.agreementStatus as agreementStatus,
        partnership.mouStatus as mouStatus,
        partnership.mouStart as mouStart,
        partnership.mouEnd as mouEnd,
        partnership.organization as organization,
        partnership.types as types
       `,
        {
          id,
          agreementStatus: input.agreementStatus,
          mouStatus: input.mouStatus,
          mouStart: input.mouStart,
          mouEnd: input.mouEnd,
          organization: input.organization,
          types: input.types,
        },
      )
      .then(result => {
        response.partnership.id = result.records[0].get('id');
        response.partnership.agreementStatus = result.records[0].get(
          'agreementStatus',
        );
        response.partnership.mouStatus = result.records[0].get('mouStatus');
        response.partnership.mouStart = result.records[0].get('mouStart');
        response.partnership.mouEnd = result.records[0].get('mouEnd');
        response.partnership.organization = result.records[0].get(
          'organization',
        );
        response.partnership.types = result.records[0].get('types');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadPartnershipInput,
  ): Promise<ReadPartnershipOutputDto> {
    const response = new ReadPartnershipOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (partnership:Partnership {active: true, owningOrg: "seedcompany"})
        WHERE partnership.id = "${input.id}"
        RETURN partnership.id as id,
        partnership.agreementStatus as agreementStatus,
        partnership.mouStatus as mouStatus,
        partnership.mouStart as mouStart,
        partnership.mouEnd as mouEnd,
        partnership.organization as organization,
        partnership.types as types`,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.partnership.id = result.records[0].get('id');
        response.partnership.agreementStatus = result.records[0].get(
          'agreementStatus',
        );
        response.partnership.mouStatus = result.records[0].get('mouStatus');
        response.partnership.mouStart = result.records[0].get('mouStart');
        response.partnership.mouEnd = result.records[0].get('mouEnd');
        response.partnership.organization = result.records[0].get(
          'organization',
        );
        response.partnership.types = result.records[0].get('types');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(
    input: UpdatePartnershipInput,
  ): Promise<UpdatePartnershipOutputDto> {
    const response = new UpdatePartnershipOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (partnership:Partnership {active: true, owningOrg: "seedcompany", id: $id})
        SET partnership.agreementStatus = $agreementStatus
        // partnership.mouStatus = $mouStatus,
        // partnership.mouStart = $mouStart,
        // partnership.mouEnd = $mouEnd,
        // partnership.organization = $organization,
        // partnership.types = $types
          RETURN partnership.id as id,
          partnership.agreementStatus as agreementStatus,
          partnership.mouStatus as mouStatus,
          partnership.mouStart as mouStart,
          partnership.mouEnd as mouEnd,
          partnership.organization as organization,
          partnership.types as types`,
        {
          id: input.id,
          agreementStatus: input.agreementStatus,
          mouStatus: input.mouStatus,
          mouStart: input.mouStart,
          mouEnd: input.mouEnd,
          organization: input.organization,
          types: input.types,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.partnership = {
            id: result.records[0].get('id'),
            agreementStatus: result.records[0].get(
              'agreementStatus',
            ),
            mouStatus: result.records[0].get('mouStatus'),
            mouStart: result.records[0].get('mouStart'),
            mouEnd: result.records[0].get('mouEnd'),
            organization: result.records[0].get(
              'organization',
            ),
            types: result.records[0].get('types'),
          }
        } else {
          throw new Error('Could not update partnership.');
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
    input: DeletePartnershipInput,
  ): Promise<DeletePartnershipOutputDto> {
    const response = new DeletePartnershipOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (partnership:Partnership {active: true, owningOrg: "seedcompany", id: $id})
         SET partnership.active = false RETURN partnership.id as id`,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.partnership.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async queryPartnerships(
    query: ListPartnershipsInput,
  ): Promise<ListPartnershipsOutputDto> {
    const response = new ListPartnershipsOutputDto();
    const session = this.db.driver.session();
    const skipIt = query.page * query.count;

    //TO DO : List all partnerships by projectId
    // const result = await session.run(
    //   `
    //     MATCH
    //       (project:Project {id: "$projectId"})-[partnerships:Partnership {active:true}]->
    //       (partner:Partnership {active:true}),
    //       (partner)-[:agreementStatus {active: true}]->(agreementStatus: Property)
    //       (partner)-[:mouStatus {active: true}]->(mouStatus: Property),
    //       (partner)-[:mouStart {active: true}]->(mouStart: Property),
    //       (partner)-[:mouEnd {active: true}]->(mouEnd: Property),
    //     RETURN
    //       partner.id as id,
    //       agreementStatus.value as agreementStatus,
    //       mouStatus.value as mouStatus,
    //       mouStart.value as mouStart,
    //       mouEnd.value as mouEnd,
    //     `,
    //     },
    // );

    const result = await session.run(
      `MATCH (partnership:Partnership {active: true}) WHERE partnership.agreementStatus CONTAINS $filter RETURN partnership.agreementStatus as agreementStatus, partnership.organization as organization ORDER BY ${query.sort} ${query.order} SKIP $skip LIMIT $count`,
      {
        filter: query.filter,
        skip: skipIt,
        count: query.count,
        sort: query.sort,
        order: query.order,
      },
    );

    session.close();

    response.partnerships = result.records.map(record => {
      const partnership = new Partnership();
      //partnership.id = record.get('id');
      partnership.agreementStatus = record.get('agreementStatus');
      partnership.organization = record.get('organization');
      return partnership;
    });

    return response;
  }
}


