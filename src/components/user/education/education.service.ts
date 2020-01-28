import { Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import {
  CreateEducation,
  SecuredEducationList,
  Education,
  EducationListInput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationService {
  constructor(private readonly db: Connection) {}

  async list(
    userId: string,
    input: EducationListInput,
    token: string,
  ): Promise<SecuredEducationList> {
    throw new Error('Not implemented');
  }

  async create(
    input: CreateEducation,
    token: string,
  ): Promise<Education> {
    throw new Error('Not implemented');
  }

  async update(
    input: UpdateEducation,
    token: string,
  ): Promise<Education> {
    throw new Error('Not implemented');
  }

  async delete(id: string, token: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
