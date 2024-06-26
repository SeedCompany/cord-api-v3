import { Injectable } from '@nestjs/common';
import {
  CreateNodeOptions,
  defineSorters,
  QueryFragment,
} from '~/core/database/query';
import { MergePeriodicReports } from '../periodic-report/dto';
import { ProgressReport, ProgressReportStatus as Status } from './dto';

@Injectable()
export class ProgressReportExtraForPeriodicInterfaceRepository {
  getCreateOptions(
    _input: MergePeriodicReports,
  ): CreateNodeOptions<typeof ProgressReport> {
    return {
      initialProps: {
        status: Status.NotStarted,
      },
    };
  }

  amendAfterCreateNode(): QueryFragment {
    return (query) => query;
  }

  extraHydrate(): QueryFragment {
    return (query) => query.return('{} as extra');
  }
}

export const progressReportExtrasSorters = defineSorters(ProgressReport, {});
