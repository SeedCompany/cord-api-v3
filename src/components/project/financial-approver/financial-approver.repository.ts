import { Injectable } from '@nestjs/common';
import { CommonRepository } from '~/core';
import { ProjectType } from '../dto';
import {
  ProjectTypeFinancialApprover,
  ProjectTypeFinancialApproverInput,
} from './financial-approver.dto';

@Injectable()
export class FinancialApproverRepository extends CommonRepository {
  async read(
    projectType: ProjectType,
  ): Promise<readonly ProjectTypeFinancialApprover[]> {
    return [];
  }

  async update(
    input: ProjectTypeFinancialApproverInput,
  ): Promise<ProjectTypeFinancialApprover | null> {
    return null;
  }
}
