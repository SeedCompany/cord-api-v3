import { ObjectType } from '@nestjs/graphql';
import { PaginatedList, SecuredList } from '~/common';
import { GTLReport } from './gtl-report.dto';

@ObjectType({
  description: SecuredList.descriptionFor('GTL reports'),
})
export abstract class GtlReportList extends SecuredList(GTLReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('GTL reports'),
}) {}
