import { Injectable } from '@nestjs/common';
import { CachedByArg, mapKeys } from '@seedcompany/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { SetNonNullable } from 'type-fest';
import { ID, PublicOf } from '~/common';
import { CommonRepository } from '~/core/database';
import { apoc, collect, exp, merge, variable } from '~/core/database/query';
import {
  PnpExtractionResult,
  PnpProblemType,
  StoredProblem,
} from './extraction-result.dto';
import { PnpExtractionResultRepository } from './pnp-extraction-result.edgedb.repository';
import { PnpExtractionResultLoadResult } from './pnp-extraction-result.loader';

@Injectable()
export class PnpExtractionResultNeo4jRepository
  extends CommonRepository
  implements PublicOf<PnpExtractionResultRepository>
{
  async read(files: ReadonlyArray<ID<'File'>>) {
    await this.syncTypesOnce();

    const found = await this.db
      .query()
      .match([
        node('file', 'File'),
        relation('out', '', 'pnpExtractionResult'),
        node('result', 'PnpExtractionResult'),
      ])
      .where({ 'file.id': inArray(files) })
      .subQuery('result', (sub) =>
        sub
          .match([
            node('result'),
            relation('out', 'problem', 'problem'),
            node('type'),
          ])
          .return<{ problems: StoredProblem }>(
            collect(
              merge('problem', {
                type: 'type.id',
                context: apoc.convert.fromJsonMap('problem.context'),
              }),
            ).as('problems'),
          ),
      )
      .return<SetNonNullable<PnpExtractionResultLoadResult>>([
        'file.id as id',
        merge('result', {
          problems: 'problems',
        }).as('result'),
      ])
      .run();
    const map = mapKeys.fromList(found, (r) => r.id).asMap;
    return files.map((id) => ({
      id,
      result: map.get(id)?.result ?? null,
    }));
  }

  async save(file: ID<'FileVersion'>, result: PnpExtractionResult) {
    await this.syncTypesOnce();

    const problems = [...result.problems.values()];

    await this.db
      .query()
      .match([
        node('file', 'File'),
        relation('in', 'parent'),
        node('', 'FileVersion', { id: file }),
      ])
      .merge([
        node('file'),
        relation('out', '', 'pnpExtractionResult'),
        node('result', 'PnpExtractionResult'),
      ])
      .setVariables({ result: '{}' }) // clear old schema - denormalized props.
      .with('result')
      .subQuery('result', (sub) =>
        sub
          .match([
            node('result'),
            relation('out', 'problem', 'problem'),
            node(),
          ])
          .delete('problem')
          .return('count(problem) as count'),
      )
      .unwind(problems, 'problem')
      .match(node('type', 'PnpProblemType', { id: variable('problem.type') }))
      .create([
        node('result'),
        relation('out', '', 'problem', {
          id: variable('problem.id'),
          source: variable('problem.source'),
          context: variable(exp('apoc.convert.toJson(problem.context)')),
        }),
        node('type'),
      ])
      .executeAndLogStats();
  }

  @CachedByArg()
  private async syncTypesOnce() {
    const types = [...PnpProblemType.types.values()].map((type) => ({
      id: type.id,
      name: type.name,
      severity: type.severity,
    }));
    await this.db
      .query()
      .unwind(types, 'type')
      .merge([node('node', 'PnpProblemType', { id: variable('type.id') })])
      .setVariables({ node: 'type' }, true)
      .run();
  }
}
