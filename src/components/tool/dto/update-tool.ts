import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, NameField } from '~/common';
import { Tool } from './tool.dto';

@InputType()
export abstract class UpdateTool {
  @Field()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @Field({ nullable: true })
  readonly aiBased?: boolean;
}

@InputType()
export abstract class UpdateToolInput {
  @Field()
  @Type(() => UpdateTool)
  @ValidateNested()
  readonly tool: UpdateTool;
}

@ObjectType()
export abstract class UpdateToolOutput {
  @Field()
  readonly tool: Tool;
}
