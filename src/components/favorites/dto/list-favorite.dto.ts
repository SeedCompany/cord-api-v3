import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Favorite } from './favorite';

@InputType()
export abstract class FavoriteFilters {
  @Field({
    description: 'Only favorites matching this id',
    nullable: true,
  })
  readonly baseNodeId?: string;
}

const defaultFilters = {};

@InputType()
export class FavoriteListInput extends SortablePaginationInput<keyof Favorite>({
  defaultSort: 'baseNodeId',
}) {
  static defaultVal = new FavoriteListInput();

  @Field({ nullable: true })
  @Type(() => FavoriteFilters)
  @ValidateNested()
  readonly filter: FavoriteFilters = defaultFilters;
}

@ObjectType()
export class FavoriteListOutput extends PaginatedList(Favorite) {}

@ObjectType({
  description: SecuredList.descriptionFor('favorites'),
})
export abstract class SecuredFavoriteList extends SecuredList(Favorite) {}
