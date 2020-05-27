import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { CreateRange } from '../../range/dto';
import { Film } from './film';

@InputType()
export abstract class CreateFilm {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => [CreateRange], { nullable: true })
  readonly ranges?: CreateRange[];
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
