import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, NameField, OptionalField } from '~/common';
import { Tool } from './tool.dto';

@InputType()
export abstract class UpdateTool {
  @Field()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @OptionalField()
  readonly aiBased?: boolean;
}

@ObjectType()
export abstract class UpdateToolOutput {
  @Field()
  readonly tool: Tool;
}
