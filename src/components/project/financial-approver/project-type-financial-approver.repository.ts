import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ServerException } from '~/common';
import { DtoRepository } from '~/core';
import { ACTIVE, merge } from '~/core/database/query';
import { ProjectType } from '../dto/project-type.enum';
import { ProjectTypeFinancialApprover } from './dto/project-type-financial-approver.dto';
import { SetProjectTypeFinancialApprover } from './dto/set-project-type-financial-approver.dto';

@Injectable()
export class ProjectTypeFinancialApproverRepository extends DtoRepository(
  ProjectTypeFinancialApprover,
) {
  async setFinancialApprover(input: SetProjectTypeFinancialApprover) {
    if (input.projectTypes.length === 0) {
      const query = this.db
        .query()
        .match([
          node('node', 'ProjectTypeFinancialApprover'),
          relation('out', '', 'financialApprover', ACTIVE),
          node('user', 'User', { id: input.user }),
        ])
        .detachDelete('node');
      await query.run();
      return null;
    }
    const query = this.db
      .query()
      .match([node('user', 'User', { id: input.user })])
      .merge([
        node('node', 'ProjectTypeFinancialApprover'),
        relation('out', '', 'financialApprover', { active: true }),
        node('user'),
      ])
      .setValues({
        'node.projectTypes': input.projectTypes.map((type) => type),
      })
      .return<{ dto: ProjectTypeFinancialApprover }>(
        merge('node', {
          user: 'user { .id }',
        }).as('dto'),
      );

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to set financial approver.');
    }

    return result;
  }

  async list(projectType: ProjectType[]) {
    const result = await this.db
      .query()
      .match([
        node('node', 'ProjectTypeFinancialApprover'),
        relation('out', '', 'financialApprover', ACTIVE),
        node('user', 'User'),
      ])
      .raw(
        `WHERE size(apoc.coll.intersection(node.projectTypes, $projectType)) > 0`,
        { projectType },
      )
      .return<{ dto: ProjectTypeFinancialApprover }>(
        merge('node', {
          user: 'user { .id }',
        }).as('dto'),
      )
      .run();
    return result;
  }
}
