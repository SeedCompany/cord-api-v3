import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField } from '~/common';
import { ScriptureField, type ScriptureRangeInput } from '../../scripture/dto';
import { Film } from './film.dto';

@InputType()
export abstract class UpdateFilm {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];
}

@ObjectType()
export abstract class FilmUpdated {
  @Field()
  readonly film: Film;
}
