import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException } from '../../common';
import { CommonRepository, ILogger, Logger } from '../../core';
import {
  ACTIVE,
  apoc,
  collect,
  merge,
  variable,
} from '../../core/database/query';
import { ProductMedium } from '../product';
import { PartnershipProducingMediumInput } from './dto/partnership-producing-medium.dto';

@Injectable()
export class PartnershipProducingMediumRepository extends CommonRepository {
  @Logger('partnership-producing-medium:repository') logger: ILogger;

  async read(engagementId: ID) {
    const res = await this.db
      .query()
      .matchNode('eng', 'LanguageEngagement', { id: engagementId })
      .comment('Grab all mediums that all products define')
      .subQuery('eng', (sub) =>
        sub
          .match([
            node('eng'),
            relation('out', '', 'product', ACTIVE),
            node('', 'Product'),
            relation('out', '', 'mediums', ACTIVE),
            node('mediumsNode', 'Property'),
          ])
          .with(
            'keys(apoc.coll.frequenciesAsMap(apoc.coll.flatten(collect(mediumsNode.value)))) as mediums'
          )
          .return(
            merge(
              '[medium in mediums | apoc.map.fromValues([medium, null])]'
            ).as('allAvailable')
          )
      )
      .comment('Grab all the defined producing partnership pairs')
      .subQuery('eng', (sub) =>
        sub
          .match([
            node('eng'),
            relation('out', 'ppm', 'PartnershipProducingMedium', ACTIVE),
            node('partnership', 'Partnership'),
          ])
          .return(
            merge(
              collect(apoc.map.fromValues(['ppm.medium', 'partnership.id']))
            ).as('defined')
          )
      )
      .return<{ out: Record<ProductMedium, ID | null> }>(
        merge('allAvailable', 'defined').as('out')
      )
      .first();
    if (!res) {
      throw new NotFoundException('Engagement not found');
    }
    return res.out;
  }

  async update(
    engagementId: ID,
    input: readonly PartnershipProducingMediumInput[]
  ) {
    const results = await this.db
      .query()
      .matchNode('eng', 'LanguageEngagement', { id: engagementId })
      .unwind(input.slice(), 'input')
      .comment(
        "Deactivate all existing PPMs that don't match the current input"
      )
      .subQuery(['eng', 'input'], (sub) =>
        sub
          .optionalMatch([
            node('eng'),
            relation('out', 'ppm', 'PartnershipProducingMedium', {
              ...ACTIVE,
              medium: variable('input.medium'),
            }),
            node('partnership', 'Partnership'),
          ])
          .raw('WHERE partnership.id <> coalesce(input.partnership, "")')
          .setVariables({
            'ppm.active': 'false',
            'ppm.deletedAt': 'datetime()',
          })
          .return('count(ppm) as previouslyActivePpmCount')
      )
      .comment(
        `
          Merge PPMs based on current input
          This will ignore partnership ID's that are null or don't match a partnership
        `
      )
      .subQuery(['eng', 'input'], (sub) =>
        sub
          .matchNode('partnership', 'Partnership', {
            id: variable('input.partnership'),
          })
          .merge([
            node('eng'),
            relation('out', 'ppm', 'PartnershipProducingMedium', {
              ...ACTIVE,
              medium: variable('input.medium'),
            }),
            node('partnership'),
          ])
          .onCreate.setVariables({
            'ppm.createdAt': 'datetime()',
          })
          .return('count(ppm) as newlyMergedPpmCount')
      )
      .return<{
        previouslyActivePpmCount: number;
        newlyMergedPpmCount: number;
      }>([
        'sum(previouslyActivePpmCount) as previouslyActivePpmCount',
        'sum(newlyMergedPpmCount) as newlyMergedPpmCount',
      ])
      .first();
    this.logger.debug('Updated', results);
  }
}
