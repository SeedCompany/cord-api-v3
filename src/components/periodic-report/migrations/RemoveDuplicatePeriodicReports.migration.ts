import { BaseMigration, Migration } from '../../../core';

@Migration('2022-01-05T00:00:00')
export class RemoveDuplicatePeriodicReportsMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .raw(
        `
          match (parent:BaseNode)-[:report { active: true }]->(report:PeriodicReport),
                (report)-[:type { active: true }]->(type),
                (report)-[:start { active: true }]->(start),
                (report)-[:end { active: true }]->(end)
          // type, start, end to strings
          with parent, report, type.value as type,
            apoc.temporal.format(start.value, "date") + "/" + apoc.temporal.format(end.value, "date") as label
          // group by parent, type, & label
          with parent, type, label, collect(report) as reports
          // filter to only duplicate reports
          where size(reports) > 1
          call {
            with reports
            unwind reports as report
            // for each report figure out if it has a file uploaded
            call {
              with report
              match (report)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(file:FileVersion)
              return count(file) > 0 as hasFile
            }
            // order reports with files first, then chronologically
            with report, hasFile
            order by hasFile desc, report.createdAt asc
            // group back up in this order to maintain the sets of duplicates
            return collect(report) as ordered
          }
          with ordered
          // Remove (to keep) the first report in each set,
          // and unwind to flat list of reports
          // This isn't perfect because it could still delete reports with files
          // But I checked and currently there's not more than one report with a file
          unwind ordered[1..] as report
          // Delete report
          detach delete report
        `
      )
      .run();
  }
}
