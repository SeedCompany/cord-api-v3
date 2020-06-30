import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../../common';
import { CreateRange } from '../../range/dto';
import { Story } from './story';

@InputType()
export abstract class CreateStory {
  @NameField()
  readonly name: string;

  @Field(() => [CreateRange], { nullable: true })
  readonly ranges?: CreateRange[];
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
