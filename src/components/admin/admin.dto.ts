import { InputType, Field, ObjectType } from 'type-graphql';

@InputType()
export class PrepareDatabaseInputDto {
  @Field()
  input: string;
}

@ObjectType()
export class PrepareDatabaseOutputDto {
  @Field()
  output: string;
}
