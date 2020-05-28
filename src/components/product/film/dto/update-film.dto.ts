import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { UpdateRange } from '../../range/dto';
import { Film } from './film';

@InputType()
export abstract class UpdateFilm {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field(() => [UpdateRange], { nullable: true })
  readonly ranges?: UpdateRange[];
}

@InputType()
export abstract class UpdateFilmInput {
  @Field()
  @Type(() => UpdateFilm)
  @ValidateNested()
  readonly film: UpdateFilm;
}

@ObjectType()
export abstract class UpdateFilmOutput {
  @Field()
  readonly film: Film;
}
