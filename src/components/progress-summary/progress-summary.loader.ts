import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import {
  OrderedNestDataLoader,
  OrderedNestDataLoaderOptions,
} from '../../core';
import { FetchedSummaries } from './dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

@Injectable({ scope: Scope.REQUEST })
export class ProgressSummaryLoader extends OrderedNestDataLoader<FetchedSummaries> {
  constructor(private readonly repo: ProgressSummaryRepository) {
    super();
  }

  getOptions(): OrderedNestDataLoaderOptions<FetchedSummaries, ID, ID> {
    return {
      ...super.getOptions(),
      propertyKey: 'reportId',
    };
  }

  async loadMany(ids: readonly ID[]) {
    return await this.repo.readMany(ids);
  }
}
