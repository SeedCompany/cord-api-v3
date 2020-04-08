import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class FiledObject {
  @Field()
  readonly value: string;
}

@ObjectType()
export class RequiredFieldListOutput {
  @Field(() => [FiledObject])
  readonly items: FiledObject[];
}
