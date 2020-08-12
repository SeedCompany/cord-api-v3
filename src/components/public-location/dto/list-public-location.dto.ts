import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { PublicLocation } from './public-location.dto';

@InputType()
export class PublicLocationListInput extends SortablePaginationInput<
  keyof PublicLocation
>({
  defaultSort: 'id',
}) {
  static defaultVal = new PublicLocationListInput();
}

@ObjectType()
export class PublicLocationListOutput extends PaginatedList(PublicLocation) {}
