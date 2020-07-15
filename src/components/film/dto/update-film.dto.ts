import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { Film } from './film.dto';

@InputType()
export abstract class UpdateFilm {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => [ScriptureRangeInput], { nullable: true })
  readonly scriptureReferences?: ScriptureRangeInput[];
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
