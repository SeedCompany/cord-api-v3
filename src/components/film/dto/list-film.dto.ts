import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Film } from './film.dto';

@InputType()
export abstract class FilmFilters {}

const defaultFilters = {};

@InputType()
export class FilmListInput extends SortablePaginationInput<keyof Film>({
  defaultSort: 'name',
}) {
  @Type(() => FilmFilters)
  @ValidateNested()
  readonly filter: FilmFilters = defaultFilters;
}

@ObjectType()
export class FilmListOutput extends PaginatedList(Film) {}
