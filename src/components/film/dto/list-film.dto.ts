import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Film } from './film.dto';

@InputType()
export abstract class FilmFilters {
  @Field({
    description: 'Only films matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class FilmListInput extends SortablePaginationInput<keyof Film>({
  defaultSort: 'name',
}) {
  static defaultVal = new FilmListInput();

  @Field({ nullable: true })
  @Type(() => FilmFilters)
  @ValidateNested()
  readonly filter: FilmFilters = defaultFilters;
}

@ObjectType()
export class FilmListOutput extends PaginatedList(Film) {}
