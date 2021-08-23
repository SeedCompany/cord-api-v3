import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ReportType } from '../dto';

@Migration('2021-08-03T15:30:05')
export class AddFinalReportMigration extends BaseMigration {
  async up() {
    await this.migrate(ReportType.Financial);
    await this.migrate(ReportType.Narrative);
    await this.migrate(ReportType.Progress);
  }

  // the finalReportMigration property is present on all the migrated :PeriodicReport nodes if there is a need to revert
  private async migrate(type: ReportType) {
    const before = await this.getBaseNodeCount(type, false);
    const baseNode = type !== ReportType.Progress ? 'projects' : 'engagements';
    this.logger.info(
      `${before} ${baseNode} with ${type} reports before migration`
    );
    await this.db
      .query()
      .raw(
        `
          call apoc.periodic.iterate('
            match (u:RootUser),
                  (b:BaseNode)-[:report]->(:${type}Report)
            with u, collect(distinct b) as baseNodes
            unwind baseNodes as baseNode
            call {
              with baseNode
              match (baseNode)-[:report]->(rn:${type}Report)-[:end]->(en:Property),
                    (rn)-[:start]->(sn:Property)
              with en, sn
              order by en.value desc, sn.value desc limit 1
              return sn.value as lastStart, en.value as lastEnd
            }
            with u, baseNode, lastStart, lastEnd
            where not lastStart = lastEnd
            return u, baseNode, lastEnd
          ', '
            create
              (baseNode)-[:report { active: true, createdAt: datetime() }]
                  ->(pr:${type}Report:PeriodicReport:BaseNode { finalReportMigration: true, createdAt: datetime(), id: apoc.create.uuid() }),
                (pr)-[:type { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: "${type}" }),
                (pr)-[:start { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: date(lastEnd) }),
                (pr)-[:end { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: date(lastEnd) }),
                (pr)-[:receivedDate { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: null }),
                (pr)-[:reportFile { active: true, createdAt: datetime() }]->(reportFile:Property { createdAt: datetime(), value: apoc.create.uuid() }),
                (pr)-[:reportFileNode { active: true } ]->(rfn:BaseFile:BaseNode:File:FileNode{ createdAt: datetime(), id: reportFile.value }),
                  (rfn)-[:createdBy { active: true, createdAt: datetime() }]->(u),
                  (rfn)-[:name { active: true, createdAt: datetime() }]->(:Property { value: toString(lastEnd) }),
                  (rfn)-[:canDelete { active: true, createdAt: datetime() }]->(:Property { value: true })
          ', {
            batchSize: 100
          })
        `
      )
      .run();
    const after = await this.getBaseNodeCount(type, true);
    this.logger.info(
      `${after} ${baseNode} with new final report after ${type} report migration`
    );
  }

  private async getBaseNodeCount(type: ReportType, after: boolean) {
    const res = await this.db
      .query()
      .match([
        node('b', 'BaseNode'),
        relation('out', '', 'report'),
        node(
          'rn',
          `${type}Report`,
          after ? { finalReportMigration: true } : {}
        ),
      ])
      .return<{ count: number }>('count(distinct b) as count')
      .first();
    return res?.count ?? 0;
  }
}
