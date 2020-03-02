import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  // async list(
  //   { page, count, sort, order, filter }: EducationListInput,
  //   session: ISession,
  // ): Promise<SecuredEducationList> {
  //   if (!filter?.userId) {
  //     throw new BadRequestException('no userId specified');
  //   }
  //   throw new NotFoundException("Not implemented");
  // }

  async list(
    { page, count, sort, order, filter }: EducationListInput,
    session: ISession,
  ): Promise<EducationListOutput> {
    const result = await this.propertyUpdater.list<Education>({
      session,
      nodevar: 'education',
      aclReadProp: 'canReadEducations',
      aclEditProp: 'canCreateEducation',
      props: [
        'degree',
        'major',
        'institution',
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      }
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async create(input: CreateEducation, session: ISession): Promise<Education> {
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
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Education',
        aclEditProp: 'canCreateEducation',
      });
    } catch (e) {
      console.log(e);
      this.logger.error(`Could not create education for user ${input.userId}`);
      throw new Error('Could not create education');
    }

    this.logger.info(`education for user ${input.userId} created, id ${id}`);

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
