import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { Song } from './song.dto';

@InputType()
export abstract class UpdateSong {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => [ScriptureRangeInput], { nullable: true })
  readonly scriptureReferences?: ScriptureRangeInput[];
}

@InputType()
export abstract class UpdateSongInput {
  @Field()
  @Type(() => UpdateSong)
  @ValidateNested()
  readonly song: UpdateSong;
}

@ObjectType()
export abstract class UpdateSongOutput {
  @Field()
  readonly song: Song;
}
