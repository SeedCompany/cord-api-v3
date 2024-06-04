import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '~/common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture/dto';
import { Film } from './film.dto';

@InputType()
export abstract class UpdateFilm {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];
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
