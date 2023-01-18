import { ObjectType } from '@nestjs/graphql';
import { PaginatedList, SecuredList } from '~/common';
import { ProgressReport } from './progress-report.entity';

@ObjectType({
  description: SecuredList.descriptionFor('progress reports'),
})
export abstract class ProgressReportList extends SecuredList(ProgressReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('progress reports'),
}) {}
