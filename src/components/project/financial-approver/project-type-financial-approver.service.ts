import { Injectable } from '@nestjs/common';
import { Session } from '~/common';
import { Privileges } from '../../authorization';
import { ProjectType } from '../dto/project-type.enum';
import { SetProjectTypeFinancialApprover } from './dto/set-project-type-financial-approver.dto';
import { ProjectTypeFinancialApproverRepository } from './project-type-financial-approver.repository';

@Injectable()
export class ProjectTypeFinancialApproverService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ProjectTypeFinancialApproverRepository,
  ) {}

  async setFinancialApprover(
    input: SetProjectTypeFinancialApprover,
    _session: Session,
  ) {
    // this.privileges
    //   .for(session, ProjectTypeFinancialApprover)
    //   .verifyCan('create');
    return await this.repo.setFinancialApprover(input);
  }

  async list(projectType: ProjectType[], _session: Session) {
    // this.privileges
    //   .for(session, ProjectTypeFinancialApprover)
    //   .verifyCan('read');
    const results = await this.repo.list(projectType);
    return results;
  }
}
