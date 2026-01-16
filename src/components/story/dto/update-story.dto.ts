import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField } from '~/common';
import { ScriptureField, type ScriptureRangeInput } from '../../scripture/dto';
import { Story } from './story.dto';

@InputType()
export abstract class UpdateStory {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];
}

@ObjectType()
export abstract class UpdateStoryOutput {
  @Field()
  readonly story: Story;
}
