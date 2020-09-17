import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Song } from './song.dto';

@InputType()
export abstract class SongFilters {}

const defaultFilters = {};

@InputType()
export class SongListInput extends SortablePaginationInput<keyof Song>({
  defaultSort: 'name',
}) {
  static defaultVal = new SongListInput();

  @Type(() => SongFilters)
  @ValidateNested()
  readonly filter: SongFilters = defaultFilters;
}

@ObjectType()
export class SongListOutput extends PaginatedList(Song) {}
