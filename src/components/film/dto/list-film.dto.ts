import { InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { Film } from './film.dto';

@InputType()
export abstract class FilmFilters {}

@InputType()
export class FilmListInput extends SortablePaginationInput<keyof Film>({
  defaultSort: 'name',
}) {
  @FilterField(() => FilmFilters, { internal: true })
  readonly filter: FilmFilters;
}

@ObjectType()
export class FilmListOutput extends PaginatedList(Film) {}
