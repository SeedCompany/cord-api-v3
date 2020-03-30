import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import { DatabaseService, ILogger, Logger } from '../../../core';
import {
  CreateEducation,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationService {
  constructor(
    @Logger('EducationService:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  async list(
    { page, count, sort, order, filter }: EducationListInput,
    session: ISession
  ): Promise<EducationListOutput> {
    const result = await this.db.list<Education>({
      session,
      nodevar: 'education',
      aclReadProp: 'canReadEducationList',
      aclEditProp: 'canCreateEducation',
      props: ['degree', 'major', 'institution'],
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

  async create(
    { userId, ...input }: CreateEducation,
    session: ISession
  ): Promise<Education> {
    const id = generate();
    const acls = {
      canReadDegree: true,
      canEditDegree: true,
      canReadMajor: true,
      canEditMajor: true,
      canReadInstitution: true,
      canEditInstitution: true,
    };

    try {
      await this.db.createNode({
        session,
        type: Education.classType,
        input: { id, ...input },
        acls,
      });
    } catch (e) {
      this.logger.error(`Could not create education for user `, {
        id,
        userId,
      });
      throw new Error('Could not create education');
    }

    this.logger.info(`Created user education`, { id, userId });

    // connect the Education to the User.
    const query = `
      MATCH (user: User {id: $userId, active: true}),
        (education:Education {id: $id, active: true})
      CREATE (user)-[:education {active: true, createdAt: datetime()}]->(education)
      RETURN  education.id as id
      `;

    await this.db
      .query()
      .raw(query, {
        userId,
        id,
      })
      .run();

    return await this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<Education> {
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
        (education:Education {active: true, id: $id})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl1:ACL {canReadDegree: true})-[:toNode]->(education)-[:degree {active: true}]->(degree:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl2:ACL {canEditDegree: true})-[:toNode]->(education)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl3:ACL {canReadMajor: true})-[:toNode]->(education)-[:major {active: true}]->(major:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl4:ACL {canEditMajor: true})-[:toNode]->(education)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl5:ACL {canReadInstitution: true})-[:toNode]->(education)-[:institution {active: true}]->(institution:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl6:ACL {canEditInstitution: true})-[:toNode]->(education)
        RETURN
          education.id as id,
          education.createdAt as createdAt,
          degree.value as degree,
          acl1.canReadDegree as canReadDegree,
          acl2.canEditDegree as canEditDegree,
          major.value as major,
          acl3.canReadMajor as canReadMajor,
          acl4.canEditMajor as canEditMajor,
          institution.value as institution,
          acl5.canReadInstitution as canReadInstitution,
          acl6.canEditInstitution as canEditInstitution
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
      throw new NotFoundException('Could not find education');
    }

    return {
      id,
      createdAt: result.createdAt,
      degree: {
        value: result.degree,
        canRead: result.canReadDegree !== null ? result.canReadDegree : false,
        canEdit: result.canEditDegree !== null ? result.canEditDegree : false,
      },
      major: {
        value: result.major,
        canRead: result.canReadMajor !== null ? result.canReadMajor : false,
        canEdit: result.canEditMajor !== null ? result.canEditMajor : false,
      },
      institution: {
        value: result.institution,
        canRead:
          result.canReadInstitution !== null
            ? result.canReadInstitution
            : false,
        canEdit:
          result.canEditInstitution !== null
            ? result.canEditInstitution
            : false,
      },
    };
  }

  async update(input: UpdateEducation, session: ISession): Promise<Education> {
    const ed = await this.readOne(input.id, session);

    return this.db.updateProperties({
      session,
      object: ed,
      props: ['degree', 'major', 'institution'],
      changes: input,
      nodevar: 'education',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const ed = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: ed,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw e;
    }
  }
}
