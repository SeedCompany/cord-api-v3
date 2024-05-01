import { Injectable } from '@nestjs/common';
import { Session } from '~/common';
import { ResourceResolver } from '~/core';
import { Privileges } from '../../authorization';
import { ProjectType } from '../dto';
import { ProjectTypeFinancialApproverInput } from './financial-approver.dto';
import { FinancialApproverRepository } from './financial-approver.repository';

@Injectable()
export class FinancialApproverService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceResolver,
    private readonly repo: FinancialApproverRepository,
  ) {}

  async list(projectType: ProjectType, session: Session) {
    // TODO: check permissions
    return await this.repo.read(projectType);
  }

  async update(input: ProjectTypeFinancialApproverInput, session: Session) {
    // // Maybe needed for upsert on Neo4j??

    // const financialApprover = await this.resources.lookup(
    //   User,
    //   input.user,
    //   session,
    // );

    // TODO: check permissions
    return await this.repo.update(input);
  }
}
