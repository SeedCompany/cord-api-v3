import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, PaginationInput } from '../../../common';
import { Pinnable } from './pinnable.dto';

@InputType()
export class PinnedListInput extends PaginationInput {
  static defaultVal = new PinnedListInput();
}

@ObjectType()
export class PinnedListOutput extends PaginatedList(Pinnable) {}
