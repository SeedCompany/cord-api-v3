import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '~/common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture/dto';
import { Story } from './story.dto';

@InputType()
export abstract class UpdateStory {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];
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
