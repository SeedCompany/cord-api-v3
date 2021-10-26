import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE } from '../../../core/database/query';

@Migration('2021-10-20T16:28:16')
export class RenameSongAndLiteracyMaterialToEthnoArts extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .match([
        node('literacyMaterial', 'LiteracyMaterial'),
        relation('out', '', 'name', ACTIVE),
        node('literacyName', 'LiteracyName'),
      ])
      .match([
        node('song', 'Song'),
        relation('out', '', 'name', ACTIVE),
        node('songName', 'SongName'),
      ])
      .removeLabels({
        literacyMaterial: 'LiteracyMaterial',
        literacyName: 'LiteracyName',
        song: 'Song',
        songName: 'SongName',
      })
      .setLabels({
        literacyMaterial: 'EthnoArt',
        literacyName: 'EthnoArtName',
        song: 'EthnoArt',
        songName: 'EthnoArtName',
      })

      .return<{ numNodesRelabeled: number }>(
        'count(distinct song) + count(distinct literacyMaterial) as numNodesRelabeled'
      )
      .first();
    this.logger.info(`${res?.numNodesRelabeled ?? 0} Relabeled producibles`);
  }
}
