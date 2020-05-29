import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { CreateRange } from '../../range/dto';
import { Story } from './story';

@InputType()
export abstract class CreateStory {
  @Field()
  @MinLength(2)
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
