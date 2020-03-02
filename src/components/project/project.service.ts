import { Injectable, NotImplementedException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { ISession } from '../auth';
import {
  CreateProject,
  ProjectListInput,
  ProjectListOutput,
  UpdateProject,
  Project,
} from './dto';

@Injectable()
export class ProjectService {
  constructor(private readonly db: Connection) {}

  async readOne(id: string, session: ISession): Promise<Project> {
    throw new NotImplementedException();
  }

  async list(
    input: ProjectListInput,
    session: ISession,
  ): Promise<ProjectListOutput> {
    throw new NotImplementedException();
  }

  async create(input: CreateProject, session: ISession): Promise<Project> {
    throw new NotImplementedException();
  }

  async update(input: UpdateProject, session: ISession): Promise<Project> {
    throw new NotImplementedException();
  }

  async delete(id: string, session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}
