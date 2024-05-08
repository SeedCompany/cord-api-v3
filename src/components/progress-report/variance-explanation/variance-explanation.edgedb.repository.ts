import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { ProgressReportVarianceExplanation as VarianceExplanation } from './variance-explanation.dto';
import { ProgressReportVarianceExplanationRepository as Neo4jRepository } from './variance-explanation.repository';

@Injectable()
export class VarianceExplanationEdgeDBRepository
  extends RepoFor(VarianceExplanation, {
    hydrate: (varianceExplanation) => ({
      ...varianceExplanation['*'],
      report: true,
    }),
  })
  implements PublicOf<Neo4jRepository> {}
