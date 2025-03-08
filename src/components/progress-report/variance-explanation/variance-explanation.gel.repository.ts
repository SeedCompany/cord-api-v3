import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { ProgressReportVarianceExplanation as VarianceExplanation } from './variance-explanation.dto';
import { ProgressReportVarianceExplanationRepository as Neo4jRepository } from './variance-explanation.repository';

@Injectable()
export class VarianceExplanationGelRepository
  extends RepoFor(VarianceExplanation, {
    hydrate: (varianceExplanation) => ({
      ...varianceExplanation['*'],
      report: true,
    }),
  })
  implements PublicOf<Neo4jRepository> {}
