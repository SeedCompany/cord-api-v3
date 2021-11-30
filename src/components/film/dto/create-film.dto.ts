import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture';
import { Film } from './film.dto';

@InputType()
export abstract class CreateFilm {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] = [];
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
