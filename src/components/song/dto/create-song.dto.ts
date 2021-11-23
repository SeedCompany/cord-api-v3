import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture';
import { Song } from './song.dto';

@InputType()
export abstract class CreateSong {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: ScriptureRangeInput[] = [];
}

@InputType()
export abstract class CreateSongInput {
  @Field()
  @Type(() => CreateSong)
  @ValidateNested()
  readonly song: CreateSong;
}

@ObjectType()
export abstract class CreateSongOutput {
  @Field()
  readonly song: Song;
}
