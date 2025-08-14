import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { NameField } from '~/common';
import { Tool } from './tool.dto';

@InputType()
export abstract class CreateTool {
  @NameField()
  readonly name: string;

  @Field()
  readonly aiBased: boolean = false;
}

@ObjectType()
export abstract class CreateToolOutput {
  @Field()
  readonly tool: Tool;
}
