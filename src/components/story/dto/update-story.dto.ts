import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { Story } from './story.dto';

@InputType()
export abstract class UpdateStory {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => [ScriptureRangeInput], { nullable: true })
  readonly scriptureReferences?: ScriptureRangeInput[];
}

@InputType()
export abstract class UpdateStoryInput {
  @Field()
  @Type(() => UpdateStory)
  @ValidateNested()
  readonly story: UpdateStory;
}

@ObjectType()
export abstract class UpdateStoryOutput {
  @Field()
  readonly story: Story;
}
