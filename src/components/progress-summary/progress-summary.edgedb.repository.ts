import { Injectable } from '@nestjs/common';
import { mapEntries } from '@seedcompany/common';
import { $ } from 'edgedb';
import { ID, PublicOf } from '~/common';
import { CommonRepository, e } from '~/core/edgedb';
import { $expr_Cast } from '~/core/edgedb/generated-client/cast';
import { $ProgressReport } from '~/core/edgedb/generated-client/modules/default';
import { ProgressReport } from '../progress-report/dto';
import { ProgressSummary, SummaryPeriod } from './dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

const { Period, Summary } = e.ProgressReport.ProductProgress;

@Injectable()
export class ProgressSummaryEdgeDBRepository
  extends CommonRepository
  implements PublicOf<ProgressSummaryRepository>
{
  async readMany(reportIds: ReadonlyArray<ID<ProgressReport>>) {
    return await this.db.run(this.readManyQuery, { ids: reportIds });
  }

  private readonly readManyQuery = e.params(
    { ids: e.array(e.uuid) },
    ({ ids }) => {
      const reports = e.cast(
        e.ProgressReport,
        e.array_unpack(ids),
      ) as any as $expr_Cast<$ProgressReport, $.Cardinality.Many>;

      return e.select(reports, (report) => {
        const scriptureProducts = e.op(
          report.engagement['<engagement[is DirectScriptureProduct]'],
          'union',
          report.engagement['<engagement[is DerivativeScriptureProduct]'],
        );
        return {
          report,

          ...mapEntries(SummaryPeriod, ([period]) => [
            period,
            e.select(Summary, (summary) => ({
              ...summary['*'],
              filter_single: { report, period: Period[period] },
            })),
          ]).asRecord,

          totalVerses: e.sum(scriptureProducts.totalVerses),
          totalVerseEquivalents: e.sum(scriptureProducts.totalVerseEquivalents),
        };
      });
    },
  );

  async save(
    report: ProgressReport,
    period: SummaryPeriod,
    data: ProgressSummary,
  ) {
    const reportEntity = e.cast(e.ProgressReport, e.uuid(report.id));

    const preExists = e.select(Summary, () => ({
      filter_single: { report: reportEntity, period: Period[period] },
    }));
    const created = e.insert(Summary, {
      report: reportEntity,
      period: Period[period],
      ...data,
    });
    const query = e.op(preExists, '??', created);

    await this.db.run(query);
  }
}
