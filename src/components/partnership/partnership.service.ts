import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipListInput,
  PartnershipListOutput,
  UpdatePartnership,
} from './dto';

@Injectable()
export class PartnershipService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('partnership:service') private readonly logger: ILogger
  ) {}

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

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadOrganization:ACL {canReadOrganization: true})-[:toNode]->(partnership)-[:organization {active: true}]->(organization)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditOrganization:ACL {canEditOrganization: true})-[:toNode]->(partnership)

        RETURN
          partnership.id as id,
          partnership.createdAt as createdAt,
          agreementStatus.value as agreementStatus,
          mouStatus.value as mouStatus,
          mouStart.value as mouStart,
          mouEnd.value as mouEnd,
          types.value as types,
          organization as organization,
          canReadAgreementStatus.canReadAgreementStatus as canReadAgreementStatus,
          canEditAgreementStatus.canEditAgreementStatus as canEditAgreementStatus,
          canReadMouStatus.canReadMouStatus as canReadMouStatus,
          canEditMouStatus.canEditMouStatus as canEditMouStatus,
          canReadMouStart.canReadMouStart as canReadMouStart,
          canEditMouStart.canEditMouStart as canEditMouStart,
          canReadMouEnd.canReadMouEnd as canReadMouEnd,
          canEditMouEnd.canEditMouEnd as canEditMouEnd,
          canReadTypes.canReadTypes as canReadTypes,
          canEditTypes.canEditTypes as canEditTypes,
          canReadOrganization.canReadOrganization as canReadOrganization,
          canEditOrganization.canEditOrganization as canEditOrganization
      `,
        {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
        }
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
      types: {
        value: result.types ?? [],
        canRead: !!result.canReadTypes,
        canEdit: !!result.canEditTypes,
      },
      organization: {
        id: result.organization.properties.id,
        createdAt: result.organization.properties.createdAt,
        name: {
          value: result.organization.properties.name,
          canRead: true,
          canEdit: true,
        },
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: PartnershipListInput,
    session: ISession
  ): Promise<PartnershipListOutput> {
    const { projectId } = filter;
    let result: {
      items: Partnership[];
      hasMore: boolean;
      total: number;
    } = { items: [], hasMore: false, total: 0 };

    if (projectId) {
      const query = `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId
        }),
        (project:Project {id: $projectId, active: true, owningOrgId: $owningOrgId})
        -[:partnership]->(partnership:Partnership {active:true})
      WITH COUNT(partnership) as total, project, partnership
          MATCH (partnership {active: true})-[:agreementStatus {active:true }]->(agreementStatus:Property {active: true})
          RETURN total, partnership.id as id, agreementStatus.value as agreementStatus, partnership.createdAt as createdAt
          ORDER BY ${sort} ${order}
          SKIP $skip LIMIT $count
      `;
      const projBudgets = await this.db
        .query()
        .raw(query, {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          projectId,
          skip: (page - 1) * count,
          count,
        })
        .run();

      result.items = await Promise.all(
        projBudgets.map(async (partnership) =>
          this.readOne(partnership.id, session)
        )
      );
    } else {
      result = await this.db.list<Partnership>({
        session,
        nodevar: 'partnership',
        aclReadProp: 'canReadPartnerships',
        aclEditProp: 'canCreatePartnership',
        props: [
          { name: 'agreementStatus', secure: true },
          { name: 'mouStatus', secure: true },
          { name: 'mouStart', secure: true },
          { name: 'mouEnd', secure: true },
          { name: 'organization', secure: false },
          { name: 'types', secure: true, list: true },
        ],
        input: {
          page,
          count,
          sort,
          order,
          filter,
        },
      });
    }

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async create(
    { organizationId, projectId, ...input }: CreatePartnership,
    session: ISession
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
      await this.db.createNode({
        session,
        type: Partnership.classType,
        input: {
          id,
          agreementStatus: PartnershipAgreementStatus.NotAttached,
          mouStatus: PartnershipAgreementStatus.NotAttached,
          ...input,
        },
        acls,
      });

      // connect the Organization to the Partnership
      // and connect Partnership to Project
      const query = `
        MATCH (organization:Organization {id: $organizationId, active: true}),
          (partnership:Partnership {id: $id, active: true}),
          (project:Project {id: $projectId, active: true})
        CREATE (project)-[:partnership {active: true, createdAt: datetime()}]->(partnership)
                  -[:organization {active: true, createdAt: datetime()}]->(organization)
        RETURN partnership.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          organizationId,
          id,
          projectId,
        })
        .first();
      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning('Failed to create partnership', {
        exception: e,
      });

      throw e;
    }
  }

  async update(input: UpdatePartnership, session: ISession) {
    const object = await this.readOne(input.id, session);

    await this.db.updateProperties({
      session,
      object,
      props: ['agreementStatus', 'mouStatus', 'mouStart', 'mouEnd', 'types'],
      changes: {
        ...input,
        types: input.types as any,
      },
      nodevar: 'partnership',
    });

    return this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find partnership');
    }

    try {
      await this.db.deleteNode({
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
}
