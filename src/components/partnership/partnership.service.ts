import { DatabaseService } from '../../core/database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import {
  CreatePartnership,
  Partnership,
  UpdatePartnership,
  PartnershipListInput,
  PartnershipListOutput,
} from './dto';
import { ISession } from '../auth';
import { PropertyUpdaterService, ILogger, Logger } from '../../core';

@Injectable()
export class PartnershipService {
  constructor(
    private readonly db: DatabaseService,
    private readonly propertyUpdater: PropertyUpdaterService,
    @Logger('partnership:service') private readonly logger: ILogger,
  ) {}

  async create(
    { organizationId, ...input }: CreatePartnership,
    session: ISession,
  ): Promise<Partnership> {
    const id = generate();
    const acls = {
      canReadAgreementStatus: true,
      canEditAgreementStatus: true,
      canReadMouStatus: true,
      canEditMouStatus: true,
      canReadMouStart: true,
      canEditMouStart: true,
      canReadMouEnd: true,
      canEditMouEnd: true,
      canReadTypes: true,
      canEditTypes: true,
      canReadOrganization: true,
      canEditOrganization: true,
    };

    try {
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Partnership',
        aclEditProp: 'canCreatePartnership',
      });

      // connect the Organization to the Partnership
      const query = `
        MATCH (org:Organization {id: $organizationId, active: true}),
          (partnership:Partnership {id: $id, active: true})
        CREATE (partnership)-[:org {active: true, createdAt: datetime()}]->(org)
        RETURN partnership.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          organizationId,
          id,
        })
        .first();

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning('Failed to create partnership', {
        exception: e,
      });

      throw new Error('Could not create partnership');
    }
  }

  // async create(
  //   input: CreatePartnershipInput,
  // ): Promise<CreatePartnershipOutputDto> {
  //   const response = new CreatePartnershipOutputDto();
  //   const session = this.db.driver.session();
  //   const id = generate();
  //   await session
  //     .run(
  //       `MERGE (partnership:Partnership {active: true, owningOrg: "seedcompany", id: $id}) ON CREATE SET partnership.id = $id, partnership.timestamp = datetime() RETURN
  //       partnership.id as id,
  //       partnership.agreementStatus as agreementStatus,
  //       partnership.mouStatus as mouStatus,
  //       partnership.mouStart as mouStart,
  //       partnership.mouEnd as mouEnd,
  //       partnership.organization as organization,
  //       partnership.types as types
  //      `,
  //       {
  //         id,
  //         agreementStatus: input.agreementStatus,
  //         mouStatus: input.mouStatus,
  //         mouStart: input.mouStart,
  //         mouEnd: input.mouEnd,
  //         organization: input.organization,
  //         types: input.types,
  //       },
  //     )
  //     .then(result => {
  //       response.partnership.id = result.records[0].get('id');
  //       response.partnership.agreementStatus = result.records[0].get(
  //         'agreementStatus',
  //       );
  //       response.partnership.mouStatus = result.records[0].get('mouStatus');
  //       response.partnership.mouStart = result.records[0].get('mouStart');
  //       response.partnership.mouEnd = result.records[0].get('mouEnd');
  //       response.partnership.organization = result.records[0].get(
  //         'organization',
  //       );
  //       response.partnership.types = result.records[0].get('types');
  //     })
  //     .catch(error => {
  //       console.log(error);
  //     })
  //     .then(() => session.close());

  //   return response;
  // }

  async readOne(id: string, session: ISession): Promise<Partnership> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (token:Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (partnership:Partnership {active: true, id: $id})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadAgreementStatus:ACL {canReadAgreementStatus: true})-[:toNode]->(partnership)-[:agreementStatus {active: true}]->(agreementStatus:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditAgreementStatus:ACL {canEditAgreementStatus: true})-[:toNode]->(partnership)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMouStatus:ACL {canReadMouStatus: true})-[:toNode]->(partnership)-[:mouStatus {active: true}]->(mouStatus:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMouStatus:ACL {canEditMouStatus: true})-[:toNode]->(partnership)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMouStart:ACL {canReadMouStart: true})-[:toNode]->(partnership)-[:mouStart {active: true}]->(mouStart:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMouStart:ACL {canEditMouStart: true})-[:toNode]->(partnership)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMouEnd:ACL {canReadMouEnd: true})-[:toNode]->(partnership)-[:mouEnd {active: true}]->(mouEnd:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMouEnd:ACL {canEditMouEnd: true})-[:toNode]->(partnership)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadTypes:ACL {canReadTypes: true})-[:toNode]->(partnership)-[:types {active: true}]->(types:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditTypes:ACL {canEditTypes: true})-[:toNode]->(partnership)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadOrganization:ACL {canReadOrganization: true})-[:toNode]->(partnership)-[:org {active: true}]->(org:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditOrganization:ACL {canEditOrganization: true})-[:toNode]->(partnership)

        RETURN
          partnership.id as id,
          partnership.createdAt as createdAt,
          agreementStatus.value as agreementStatus,
          mouStatus.value as mouStatus,
          mouStart.value as mouStart,
          mouEnd.value as mouEnd,
          types.value as types,
          canReadAgreementStatus.canReadAgreementStatus as canReadAgreementStatus,
          canEditAgreementStatus.canEditAgreementStatus as canEditAgreementStatus,
          canReadMouStatus.canReadMouStatus as canReadMouStatus,
          canEditMouStatus.canEditMouStatus as canEditMouStatus,
          canReadMouStart.canReadMouStart as canReadMouStart,
          canEditMouStart.canEditMouStart as canEditMouStart,
          canReadMouEnd.canReadMouEnd as canReadMouEnd,
          canEditMouEnd.canEditMouEnd as canEditMouEnd,
          canReadTypes.canReadTypes as canReadTypes,
          canEditTypes.canEditTypes as canEditTypes
      `,
        {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find partnership');
    }

    return {
      id,
      createdAt: result.createdAt,
      agreementStatus: {
        value: result.agreementStatus,
        canRead: !!result.canReadAgreementStatus,
        canEdit: !!result.canEditAgreementStatus,
      },
      mouStatus: {
        value: result.mouStatus,
        canRead: !!result.canReadMouStatus,
        canEdit: !!result.canEditMouStatus,
      },
      mouStart: {
        value: result.mouStart,
        canRead: !!result.canReadMouStart,
        canEdit: !!result.canEditMouStart,
      },
      mouEnd: {
        value: result.mouEnd,
        canRead: !!result.canReadMouEnd,
        canEdit: !!result.canEditMouEnd,
      },
      types: result.types?.length ? result.types.split(',') : [],
      // FIXME
      // types: {
      //   value: result.types,
      //   canRead: !!result.canReadTypes,
      //   canEdit: !!result.canEditTypes,
      // },
      // FIXME
      organization: result.org,
    };
  }

  // async readOne(
  //   input: ReadPartnershipInput,
  // ): Promise<ReadPartnershipOutputDto> {
  //   const response = new ReadPartnershipOutputDto();
  //   const session = this.db.driver.session();
  //   await session
  //     .run(
  //       `MATCH (partnership:Partnership {active: true, owningOrg: "seedcompany"})
  //       WHERE partnership.id = "${input.id}"
  //       RETURN partnership.id as id,
  //       partnership.agreementStatus as agreementStatus,
  //       partnership.mouStatus as mouStatus,
  //       partnership.mouStart as mouStart,
  //       partnership.mouEnd as mouEnd,
  //       partnership.organization as organization,
  //       partnership.types as types`,
  //       {
  //         id: input.id,
  //       },
  //     )
  //     .then(result => {
  //       response.partnership.id = result.records[0].get('id');
  //       response.partnership.agreementStatus = result.records[0].get(
  //         'agreementStatus',
  //       );
  //       response.partnership.mouStatus = result.records[0].get('mouStatus');
  //       response.partnership.mouStart = result.records[0].get('mouStart');
  //       response.partnership.mouEnd = result.records[0].get('mouEnd');
  //       response.partnership.organization = result.records[0].get(
  //         'organization',
  //       );
  //       response.partnership.types = result.records[0].get('types');
  //     })
  //     .catch(error => {
  //       console.log(error);
  //     })
  //     .then(() => session.close());

  //   return response;
  // }

  async update(input: UpdatePartnership, session: ISession) {
    const object = await this.readOne(input.id, session);

    return this.propertyUpdater.updateProperties({
      session,
      object,
      props: ['agreementStatus', 'mouStatus', 'mouStart', 'mouEnd', 'types'],
      changes: input,
      nodevar: 'partnership',
    });
  }

  // async update(
  //   input: UpdatePartnershipInput,
  // ): Promise<UpdatePartnershipOutputDto> {
  //   const response = new UpdatePartnershipOutputDto();
  //   const session = this.db.driver.session();
  //   await session
  //     .run(
  //       `MATCH (partnership:Partnership {active: true, owningOrg: "seedcompany", id: $id})
  //       SET partnership.agreementStatus = $agreementStatus
  //       // partnership.mouStatus = $mouStatus,
  //       // partnership.mouStart = $mouStart,
  //       // partnership.mouEnd = $mouEnd,
  //       // partnership.organization = $organization,
  //       // partnership.types = $types
  //         RETURN partnership.id as id,
  //         partnership.agreementStatus as agreementStatus,
  //         partnership.mouStatus as mouStatus,
  //         partnership.mouStart as mouStart,
  //         partnership.mouEnd as mouEnd,
  //         partnership.organization as organization,
  //         partnership.types as types`,
  //       {
  //         id: input.id,
  //         agreementStatus: input.agreementStatus,
  //         mouStatus: input.mouStatus,
  //         mouStart: input.mouStart,
  //         mouEnd: input.mouEnd,
  //         organization: input.organization,
  //         types: input.types,
  //       },
  //     )
  //     .then(result => {
  //       if (result.records.length > 0) {
  //         response.partnership = {
  //           id: result.records[0].get('id'),
  //           agreementStatus: result.records[0].get(
  //             'agreementStatus',
  //           ),
  //           mouStatus: result.records[0].get('mouStatus'),
  //           mouStart: result.records[0].get('mouStart'),
  //           mouEnd: result.records[0].get('mouEnd'),
  //           organization: result.records[0].get(
  //             'organization',
  //           ),
  //           types: result.records[0].get('types'),
  //         }
  //       } else {
  //         throw new Error('Could not update partnership.');
  //       }
  //     })
  //     .catch(error => {
  //       console.log(error);
  //       throw error;
  //     })
  //     .then(() => session.close());

  //   return response;
  // }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find partnership');
    }

    try {
      await this.propertyUpdater.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete partnership', {
        exception: e,
      });

      throw e;
    }
  }

  // async delete(
  //   input: DeletePartnershipInput,
  // ): Promise<DeletePartnershipOutputDto> {
  //   const response = new DeletePartnershipOutputDto();
  //   const session = this.db.driver.session();
  //   await session
  //     .run(
  //       `MATCH (partnership:Partnership {active: true, owningOrg: "seedcompany", id: $id})
  //        SET partnership.active = false RETURN partnership.id as id`,
  //       {
  //         id: input.id,
  //       },
  //     )
  //     .then(result => {
  //       response.partnership.id = result.records[0].get('id');
  //     })
  //     .catch(error => {
  //       console.log(error);
  //     })
  //     .then(() => session.close());

  //   return response;
  // }

  async list(
    { page, count, sort, order, filter }: PartnershipListInput,
    session: ISession,
  ): Promise<PartnershipListOutput> {
    const result = await this.propertyUpdater.list<Partnership>({
      session,
      nodevar: 'partnership',
      aclReadProp: 'canReadPartnerships',
      aclEditProp: 'canCreatePartnership',
      props: ['agreementStatus', 'mouStatus', 'mouStart', 'mouEnd', 'types'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  // async queryPartnerships(
  //   query: ListPartnershipsInput,
  // ): Promise<ListPartnershipsOutputDto> {
  //   const response = new ListPartnershipsOutputDto();
  //   const session = this.db.driver.session();
  //   const skipIt = query.page * query.count;

  //   //TO DO : List all partnerships by projectId
  //   // const result = await session.run(
  //   //   `
  //   //     MATCH
  //   //       (project:Project {id: "$projectId"})-[partnerships:Partnership {active:true}]->
  //   //       (partner:Partnership {active:true}),
  //   //       (partner)-[:agreementStatus {active: true}]->(agreementStatus: Property)
  //   //       (partner)-[:mouStatus {active: true}]->(mouStatus: Property),
  //   //       (partner)-[:mouStart {active: true}]->(mouStart: Property),
  //   //       (partner)-[:mouEnd {active: true}]->(mouEnd: Property),
  //   //     RETURN
  //   //       partner.id as id,
  //   //       agreementStatus.value as agreementStatus,
  //   //       mouStatus.value as mouStatus,
  //   //       mouStart.value as mouStart,
  //   //       mouEnd.value as mouEnd,
  //   //     `,
  //   //     },
  //   // );

  //   const result = await session.run(
  //     `MATCH (partnership:Partnership {active: true}) WHERE partnership.agreementStatus CONTAINS $filter RETURN partnership.agreementStatus as agreementStatus, partnership.organization as organization ORDER BY ${query.sort} ${query.order} SKIP $skip LIMIT $count`,
  //     {
  //       filter: query.filter,
  //       skip: skipIt,
  //       count: query.count,
  //       sort: query.sort,
  //       order: query.order,
  //     },
  //   );

  //   session.close();

  //   response.partnerships = result.records.map(record => {
  //     const partnership = new Partnership();
  //     //partnership.id = record.get('id');
  //     partnership.agreementStatus = record.get('agreementStatus');
  //     partnership.organization = record.get('organization');
  //     return partnership;
  //   });

  //   return response;
  // }
}
