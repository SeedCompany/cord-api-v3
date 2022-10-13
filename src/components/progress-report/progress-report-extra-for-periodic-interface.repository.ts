import { Injectable } from '@nestjs/common';
import { CreateNodeOptions, QueryFragment } from '~/core/database/query';
import { MergePeriodicReports } from '../periodic-report/dto';
import { ProgressReport } from './dto';

@Injectable()
export class ProgressReportExtraForPeriodicInterfaceRepository {
  getCreateOptions(
    _input: MergePeriodicReports
  ): CreateNodeOptions<typeof ProgressReport> {
    return {};
  }

  amendAfterCreateNode(): QueryFragment {
    return (query) => query;
  }

  extraHydrate(): QueryFragment {
    return (query) => query.return('{} as extra');
  }
}
