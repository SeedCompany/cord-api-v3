import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, PaginationInput } from '../../../common';
import { Flaggable } from './flaggable.dto';

@InputType()
export class PinnedListInput extends PaginationInput {
  static defaultVal = new PinnedListInput();
}

@ObjectType()
export class PinnedListOutput extends PaginatedList(Flaggable) {}
