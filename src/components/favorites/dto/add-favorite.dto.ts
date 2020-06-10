import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Favorite } from './favorite';

@InputType()
export abstract class AddFavorite {
  @Field()
  @MinLength(2)
  readonly baseNodeId: string;
}

@InputType()
export abstract class AddFavoriteInput {
  @Field()
  @Type(() => AddFavorite)
  @ValidateNested()
  readonly favorite: AddFavorite;
}

@ObjectType()
export abstract class AddFavoriteOutput {
  @Field()
  readonly favorite: Favorite;
}
