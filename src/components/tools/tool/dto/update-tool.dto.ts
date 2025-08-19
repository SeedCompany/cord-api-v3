import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField, OptionalField } from '~/common';
import { Tool } from './tool.dto';

@InputType()
export abstract class UpdateTool {
  @IdField()
  readonly id: ID<Tool>;

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
