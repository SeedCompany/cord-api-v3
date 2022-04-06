import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '../../../common';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, createNode } from '../../../core/database/query';
import { Directory, FileService } from '../../file';

@Migration('2021-08-16T17:00:13')
export class RenameReportFileToPnpMigration extends BaseMigration {
  constructor(private readonly files: FileService) {
    super();
  }

  async up() {
    await this.renameReportFileToPnp();
    await this.createDirectories();
  }

  private async renameReportFileToPnp() {
    await this.db
      .query()
      .raw(
        `
      MATCH (:ProgressReport)-[rel]->(:FileNode)
      WITH collect(rel) AS rels
      CALL apoc.refactor.rename.type("reportFileNode", "pnpNode", rels)
      YIELD committedOperations
      RETURN committedOperations
    `
      )
      .run();

    await this.db
      .query()
      .raw(
        `
      MATCH (:ProgressReport)-[rel]->(:Property)
      WITH collect(rel) AS rels
      CALL apoc.refactor.rename.type("reportFile", "pnp", rels)
      YIELD committedOperations
      RETURN committedOperations
    `
      )
      .run();
  }

  private async createDirectory() {
    const initialProps = {
      name: 'Report Directory',
      canDelete: true,
    };
    const directory = await this.db
      .query()
      .apply(await createNode(Directory, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();

    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id: directory?.id })],
        [node('user', 'RootUser')],
      ])
      .create([
        node('node'),
        relation('out', '', 'createdBy', {
          createdAt: DateTime.local(),
          active: true,
        }),
        node('user'),
      ])
      .run();

    return directory;
  }

  private async createDirectories() {
    const result = await this.db
      .query()
      .match([node('report', 'PeriodicReport')])
      .return<{ reportIds: ID[] }>('collect(report.id) as reportIds')
      .first();

    if (result) {
      const createdAt = DateTime.local();

      for (const reportId of result.reportIds) {
        const directory = await this.createDirectory();

        await this.db
          .query()
          .match([node('report', 'PeriodicReport', { id: reportId })])
          .match([node('directory', 'Directory', { id: directory?.id })])
          .create([
            node('report'),
            relation('out', '', 'directory', { active: true, createdAt }),
          ])
          .run();

        if (directory) {
          await this.moveReportFilesToDirectory(reportId, directory.id);
        }
      }
    }
  }

  private async moveReportFilesToDirectory(reportId: ID, directoryId: ID) {
    await this.db
      .query()
      .match([
        node('report', 'PeriodicReport', { id: reportId }),
        relation('out', '', 'reportFile', ACTIVE),
        node('file', 'FileNode'),
      ])
      .match([
        [node('newParent', [], { id: directoryId })],
        [
          node('file'),
          relation('out', 'rel', 'parent', ACTIVE),
          node('oldParent', []),
        ],
      ])
      .delete('rel')
      .create([
        node('newParent'),
        relation('in', '', 'parent', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('file'),
      ])
      .run();
  }
}