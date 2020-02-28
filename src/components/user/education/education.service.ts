import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import { ILogger, Logger, PropertyUpdaterService } from '../../../core';
import { ISession } from '../../auth';
import {
  CreateEducation,
  SecuredEducationList,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationService {
  constructor(
    private readonly db: Connection,
    @Logger('EducationService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}

  async list(
    educationId: string,
    input: EducationListInput,
    token: string,
  ): Promise<SecuredEducationList> {
    this.logger.info('Listing educations', { input, token });
    throw new Error('Not implemented');
  }

  async educationlist(
    { page, count, sort, order, filter }: EducationListInput,
    { token }: ISession,
  ): Promise<EducationListOutput> {
    let query = `
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
        (education:Education {active: true, id: $id})`;

    if (filter) {
      query += `
           WHERE
        name.value CONTAINS $filter`;
    }
    query += `
      WITH count(education) as total, education
      MATCH
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
        ORDER BY ${sort} ${order}
        SKIP $skip
        LIMIT $count
      `;

    const result = await this.db
      .query()
      .raw(query, {
        filter: filter.userId, // TODO Handle no filter
        skip: (page - 1) * count,
        count,
        token,
      })
      .run();

    const items = result.map<Education>(row => ({
      id: row.id,
      createdAt: row.createdAt,
      degree: {
        value: row.degree,
        canRead: row.canReadDegree !== null ? row.canReadDegree : false,
        canEdit: row.canEditDegree !== null ? row.canEditDegree : false,
      },
      major: {
        value: row.major,
        canRead: row.canReadMajor !== null ? row.canReadMajor : false,
        canEdit: row.canEditMajor !== null ? row.canEditMajor : false,
      },
      institution: {
        value: row.institution,
        canRead: row.canReadInstitution !== null ? row.canReadInstitution : false,
        canEdit: row.canEditInstitution !== null ? row.canEditInstitution : false,
      },
    }));

    const hasMore = (page - 1) * count + count < result[0].total; // if skip + count is less than total there is more

    return {
      items,
      hasMore,
      total: result[0].total,
    };
  }

  async create(
    input: CreateEducation,
    session: ISession,
  ): Promise<Education> {
    const id = generate();
    const acls = {
      canReadDegree: true,
      canEditDegree: true,
      canReadMajor: true,
      canEditMajor: true,
      canReadInstitution: true,
      canEditInstitution: true
    };

    try {
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Education',
        aclEditProp: 'canCreateEducation',
      });
    } catch (e) {
      console.log(e);
      this.logger.error(`Could not create education for user ${input.userId}`,);
      throw new Error('Could not create education');
    }

    this.logger.info(`education for user ${input.userId} created, id ${id}`,);
    console.log(`education for user ${input.userId} created, id ${id}`);

    // connect the Education to the User.
    const query = `
      MATCH (user: User {id: $userId, active: true}),
        (education:Education {id: $id, active: true})
      CREATE (user)-[:education {active: true, createdAt: datetime()}]->(education)
      RETURN  education.id as id
      `;

    const result = await this.db
      .query()
      .raw(query, {
        userId: session.userId,
        id,
      })
      .first();
    
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
        },
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

    return this.propertyUpdater.updateProperties({
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
      this.propertyUpdater.deleteNode({
        session,
        object: ed,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
