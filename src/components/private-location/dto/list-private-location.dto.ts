import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { PrivateLocation } from './private-location.dto';

@InputType()
export class PrivateLocationListInput extends SortablePaginationInput<
  keyof PrivateLocation
>({
  defaultSort: 'name',
}) {
  static defaultVal = new PrivateLocationListInput();
}

@ObjectType()
export class PrivateLocationListOutput extends PaginatedList(PrivateLocation) {}
