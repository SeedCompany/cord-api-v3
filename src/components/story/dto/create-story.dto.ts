import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture';
import { Story } from './story.dto';

@InputType()
export abstract class CreateStory {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] = [];
}

@InputType()
export abstract class CreateStoryInput {
  @Field()
  @Type(() => CreateStory)
  @ValidateNested()
  readonly story: CreateStory;
}

@ObjectType()
export abstract class CreateStoryOutput {
  @Field()
  readonly story: Story;
}
