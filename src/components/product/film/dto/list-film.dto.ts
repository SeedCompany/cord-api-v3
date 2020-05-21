import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Film } from './film';

@InputType()
export abstract class FilmFilters {
  @Field({
    description: 'Only Film matching this name',
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

@ObjectType({
  description: SecuredList.descriptionFor('films'),
})
export abstract class SecuredFilmList extends SecuredList(Film) {}
