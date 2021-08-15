import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, PaginationInput } from '../../../common';
import { Flaggable } from './flaggable.dto';

@InputType()
export class FlaggedListInput extends PaginationInput {
  static defaultVal = new FlaggedListInput();
}

@ObjectType()
export class FlaggedListOutput extends PaginatedList(Flaggable) {}
