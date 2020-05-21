import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Film } from './film';
import { RangeInput } from './range';

@InputType()
export abstract class CreateFilm {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => RangeInput, { nullable: true })
  readonly range?: RangeInput;
}

@InputType()
export abstract class CreateFilmInput {
  @Field()
  @Type(() => CreateFilm)
  @ValidateNested()
  readonly film: CreateFilm;
}

@ObjectType()
export abstract class CreateFilmOutput {
  @Field()
  readonly film: Film;
}
