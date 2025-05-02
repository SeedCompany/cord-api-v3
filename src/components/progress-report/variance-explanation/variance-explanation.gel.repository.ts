import { Injectable } from '@nestjs/common';
import { type PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { ProgressReportVarianceExplanation as VarianceExplanation } from './variance-explanation.dto';
import { type ProgressReportVarianceExplanationRepository as Neo4jRepository } from './variance-explanation.repository';

@Injectable()
export class VarianceExplanationGelRepository
  extends RepoFor(VarianceExplanation, {
    hydrate: (varianceExplanation) => ({
      ...varianceExplanation['*'],
      report: true,
    }),
  })
  implements PublicOf<Neo4jRepository> {}
