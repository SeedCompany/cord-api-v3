import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { MarketingLocation } from './marketing-location.dto';

@InputType()
export class MarketingLocationListInput extends SortablePaginationInput<
  keyof MarketingLocation
>({
  defaultSort: 'name',
}) {
  static defaultVal = new MarketingLocationListInput();
}

@ObjectType()
export class MarketingLocationListOutput extends PaginatedList(
  MarketingLocation
) {}
