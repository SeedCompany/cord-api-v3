import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { UpdateRange } from '../../range/dto';
import { Story } from './story';

@InputType()
export abstract class UpdateStory {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
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
