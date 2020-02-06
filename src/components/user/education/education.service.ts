import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ILogger, Logger } from '../../../core/logger';
import {
  CreateEducation,
  SecuredEducationList,
  Education,
  EducationListInput,
  UpdateEducation,
} from './dto';
import { IRequestUser } from '../../../common';

@Injectable()
export class EducationService {
  constructor(
    private readonly db: Connection,
    @Logger('EducationService:service') private readonly logger: ILogger,
  ) {}

  async list(
    educationId: string,
    input: EducationListInput,
    token: string,
  ): Promise<SecuredEducationList> {
    this.logger.info('Listing educations', { input, token });
    throw new Error('Not implemented');
  }

  async create(
    input: CreateEducation,
    token: IRequestUser,
  ): Promise<Education> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH (token:Token {active: true, value: $token})
        CREATE
          (education:Education {
            id: $id,
            active: true,
            createdAt: datetime(),
            canRead: true,
            canEdit: true
          })
          -[:degree {active: true}]->
          (degree:Property {
            active: true,
            value: $degree
          }),
          (education)-[:token {active: true, createdAt: datetime()}]->(token),
          (education)-[:major {active: true, createdAt: datetime()}]->
          (major:Property {
            active: true,
            value: $major
          }),
          (education)-[:institution {active: true, createdAt: datetime()}]->
          (institution:Property {
            active: true,
            value: $institution
          })
        RETURN
          education.id as id,
          degree.value as degree,
          major.value as major,
          institution.value as institution
        `,
        {
          id: generate(),
          token: token.token,
          degree: input.degree,
          major: input.major,
          institution: input.institution,
        },
      )
      .first();
    if (!result) {
      throw new Error('Could not create education');
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      degree: result.degree,
      major: result.major,
      institution: result.institution,
      canRead: true,
      canEdit: true,
    };
  }

  async readOne(id: string, token: IRequestUser): Promise<Education> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (education:Education {active: true, id: $id}),
          (education)-[:degree {active: true}]->(degree:Property {active: true}),
          (education)-[:major {active: true}]->(major:Property {active: true}),
          (education)-[:institution {active: true}]->(institution:Property {active: true})
        RETURN
          education.id as id,
          degree.value as degree,
          major.value as major,
          institution.value as institution
        `,
        {
          token: token.token,
          id
        },
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find education');
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      degree: result.degree,
      major: result.major,
      institution: result.institution,
      canRead: true,
      canEdit: true,
    };
  }

  async update(
    input: UpdateEducation,
    token: string,
  ): Promise<Education> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (education:Education {active: true, id: $id}),
          (education)-[:degree {active: true}]->(degree:Property {active: true}),
          (education)-[:major {active: true}]->(major:Property {active: true}),
          (education)-[:institution {active: true}]->(institution:Property {active: true})
        SET
          degree.value = $degree,
          major.value = $major,
          institution.value = $institution
        RETURN
          education.id as id,
          degree.value as degree,
          major.value as major,
          institution.value as institution
        `,
        {
          id: input.id,
          degree: input.degree,
          major: input.major,
          institution: input.institution,
        },
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find education');
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      degree: result.degree,
      major: result.major,
      institution: result.institution,
      canRead: true,
      canEdit: true,
    };
  }

  async delete(id: string, token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
        MATCH
          (education:Education {active: true, id: $id})
        SET
          education.active = false
        RETURN
          education.id as id
        `,
        {
          id,
        },
      )
      .run();
  }
}
