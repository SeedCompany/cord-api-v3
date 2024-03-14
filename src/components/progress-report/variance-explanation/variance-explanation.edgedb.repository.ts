import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { ProgressReportVarianceExplanation } from './variance-explanation.dto';
import { ProgressReportVarianceExplanationRepository } from './variance-explanation.repository';

@Injectable()
export class VarianceExplanationEdgeDBRepository
  extends RepoFor(ProgressReportVarianceExplanation, {
    hydrate: (varianceExplanation) => ({
      ...varianceExplanation['*'],
      report: true,
    }),
  }).withDefaults()
  implements PublicOf<ProgressReportVarianceExplanationRepository> {}
