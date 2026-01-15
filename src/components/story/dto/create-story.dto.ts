import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { NameField } from '~/common';
import { ScriptureField, type ScriptureRangeInput } from '../../scripture/dto';
import { Story } from './story.dto';

@InputType()
export abstract class CreateStory {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] = [];
}

@ObjectType()
export abstract class CreateStoryOutput {
  @Field()
  readonly story: Story;
}
