import { Field, InputType, ObjectType } from '@nestjs/graphql';

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
