import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { NameField } from '~/common';
import { ToolKey } from './tool-key.enum';
import { Tool } from './tool.dto';

@InputType()
export abstract class CreateTool {
  @NameField()
  readonly name: string;

  @Field()
  readonly aiBased: boolean = false;

  @Field(() => ToolKey, { nullable: true })
  readonly key?: ToolKey;
}

@ObjectType()
export abstract class ToolCreated {
  @Field()
  readonly tool: Tool;
}
