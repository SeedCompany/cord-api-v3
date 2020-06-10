import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { BaseNode } from './base-node';
import { Favorite } from './favorite';

@InputType()
export abstract class FavoriteFilters {
  @Field(() => BaseNode, {
    description: 'Only items matching this node',
    nullable: true,
  })
  readonly baseNode?: BaseNode;
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
