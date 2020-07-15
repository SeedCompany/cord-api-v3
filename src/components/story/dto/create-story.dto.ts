import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { Story } from './story.dto';

@InputType()
export abstract class CreateStory {
  @NameField()
  readonly name: string;

  @Field(() => [ScriptureRangeInput], { nullable: true })
  readonly scriptureReferences?: ScriptureRangeInput[] = [];
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
