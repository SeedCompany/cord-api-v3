import { InputType, Field, ObjectType } from 'type-graphql';

@InputType()
export class AdminInputDto {
  @Field()
  input: string;
}

@ObjectType()
export class AdminOutputDto {
  @Field({ nullable: true })
  success: true;
}
