import { InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { Song } from './song.dto';

@InputType()
export abstract class SongFilters {}

@InputType()
export class SongListInput extends SortablePaginationInput<keyof Song>({
  defaultSort: 'name',
}) {
  @FilterField(SongFilters, { internal: true })
  readonly filter: SongFilters;
}

@ObjectType()
export class SongListOutput extends PaginatedList(Song) {}
