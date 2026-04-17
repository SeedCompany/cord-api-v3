import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField, OptionalField } from '~/common';
import { ToolKey } from './tool-key.enum';
import { Tool } from './tool.dto';

@InputType()
export abstract class UpdateTool {
  @IdField()
  readonly id: ID<Tool>;

  @NameField({ optional: true })
  readonly name?: string;

  @Field(() => String, { nullable: true })
  readonly description?: string | null;

  @OptionalField()
  readonly aiBased?: boolean;

  @OptionalField(() => ToolKey)
  readonly key?: ToolKey;
}

@ObjectType()
export abstract class ToolUpdated {
  @Field()
  readonly tool: Tool;
}
