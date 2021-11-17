import { hasLabel, node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE } from '../../../core/database/query';

@Migration('2021-10-20T16:28:16')
export class RenameSongAndLiteracyMaterialToEthnoArts extends BaseMigration {
  async up() {
    // Replace "Unknown" Literacy Material with "Unknown" Song and delete the former
    // This should fix the only duplicate below when merging.
    await this.db
      .query()
      .match([
        [
          node('product', 'Product'),
          relation('out', 'produces', 'produces', ACTIVE),
          node('unknownLM', 'LiteracyMaterial'),
          relation('out', '', 'name', ACTIVE),
          node('name', 'Property', { value: 'Unknown' }),
        ],
        [
          node('unknownSong', 'Song'),
          relation('out', '', 'name', ACTIVE),
          node('', 'Property', { value: 'Unknown' }),
        ],
      ])
      .detachDelete(['produces', 'unknownLM', 'name'])
      .create([
        node('product'),
        relation('out', 'produces', ACTIVE),
        node('unknownSong'),
      ])
      .return('*')
      .run();

    const res = await this.db
      .query()
      .match([
        node('producible', 'Producible'),
        relation('out', '', 'name', ACTIVE),
        node('name', 'Property'),
      ])
      .where({
        producible: [hasLabel('LiteracyMaterial'), hasLabel('Song')],
      })
      .removeLabels({
        producible: ['LiteracyMaterial', 'Song'],
        name: ['LiteracyName', 'SongName'],
      })
      .setLabels({
        producible: 'EthnoArt',
        name: 'EthnoArtName',
      })
      .return<{ numNodesRelabeled: number }>(
        'count(producible) as numNodesRelabeled'
      )
      .first();
    this.logger.info(`${res?.numNodesRelabeled ?? 0} Relabeled producibles`);
  }
}
