import { Injectable } from '@nestjs/common';
import { many, type Many } from '@seedcompany/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { type PublicOf, ServerException } from '~/common';
import { CommonRepository } from '~/core/database';
import { ACTIVE, merge } from '~/core/database/query';
import { type ProjectType } from '../dto/project-type.enum';
import { type FinancialApprover, type FinancialApproverInput } from './dto';
import { type FinancialApproverRepository } from './financial-approver.repository';

@Injectable()
export class FinancialApproverNeo4jRepository
  extends CommonRepository
  implements PublicOf<FinancialApproverRepository>
{
  async read(types?: Many<ProjectType>) {
    const query = this.db
      .query()
      .match([
        node('node', 'ProjectTypeFinancialApprover'),
        relation('out', '', 'financialApprover', ACTIVE),
        node('user', 'User'),
      ])
      .apply((q) =>
        types
          ? q.raw(`WHERE size(apoc.coll.intersection(node.projectTypes, $types)) > 0`, {
              types: many(types),
            })
          : q,
      )
      .apply(this.hydrate());
    return await query.run();
  }

  async write(input: FinancialApproverInput) {
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
      .match(node('user', 'User', { id: input.user }))
      .merge([
        node('node', 'ProjectTypeFinancialApprover'),
        relation('out', '', 'financialApprover', { active: true }),
        node('user'),
      ])
      .setValues({
        'node.projectTypes': input.projectTypes,
      })
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to set financial approver.');
    }

    return result;
  }

  private hydrate() {
    return (query: Query) =>
      query
        .with('node, user')
        .optionalMatch([node('user'), relation('out', '', 'email', ACTIVE), node('email')])
        .return<{ dto: FinancialApprover }>(
          merge('node', {
            user: merge('user { .id }', { email: 'email.value' }),
          }).as('dto'),
        )
        .map('dto');
  }
}
