import { Field, ID, InputType } from 'type-graphql';

@InputType()
export class AddPropertyToSecurityGroup {
  @Field(() => ID)
  readonly sgId: string;

  @Field()
  readonly property: string;
}

@InputType()
export abstract class AddPropertyToSecurityGroupInput {
  @Field()
  readonly request: AddPropertyToSecurityGroup;
}
