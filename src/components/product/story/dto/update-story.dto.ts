import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../../common';
import { UpdateRange } from '../../range/dto';
import { Story } from './story';

@InputType()
export abstract class UpdateStory {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => [UpdateRange], { nullable: true })
  readonly ranges?: UpdateRange[];
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
