import { Injectable } from '@nestjs/common';
import { groupToMapBy, mapKeys } from '@seedcompany/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { SetNonNullable } from 'type-fest';
import { ID, PublicOf } from '~/common';
import { CommonRepository } from '~/core/database';
import { apoc, merge } from '~/core/database/query';
import {
  PnpExtractionResult,
  PnpProblemSeverity as Severity,
} from './extraction-result.dto';
import { PnpExtractionResultRepository } from './pnp-extraction-result.edgedb.repository';
import { PnpExtractionResultLoadResult } from './pnp-extraction-result.loader';

@Injectable()
export class PnpExtractionResultNeo4jRepository
  extends CommonRepository
  implements PublicOf<PnpExtractionResultRepository>
{
  async read(files: ReadonlyArray<ID<'File'>>) {
    const found = await this.db
      .query()
      .match([
        node('file', 'File'),
        relation('out', '', 'pnpExtractionResult'),
        node('result', 'PnpExtractionResult'),
      ])
      .where({ 'file.id': inArray(files) })
      .return<SetNonNullable<PnpExtractionResultLoadResult>>([
        'file.id as id',
        merge('result', {
          problems: apoc.convert.fromJsonList('result.problems'),
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
    const bySev = groupToMapBy(result.problems, (p) => p.severity);
    const stats = Object.fromEntries(
      [...Severity].flatMap((severity) => [
        [`result.has${severity}`, bySev.has(severity)],
        [`result.count${severity}`, bySev.get(severity)?.length ?? 0],
      ]),
    );

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
      .apply((q) => {
        q.params.addParam(result.problems, 'problems');
      })
      .setValues(stats)
      .setVariables({
        'result.problems': 'apoc.convert.toJson($problems)',
      })
      .executeAndLogStats();
  }
}
