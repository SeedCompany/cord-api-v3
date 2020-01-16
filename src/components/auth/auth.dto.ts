import { InputType, Field, ObjectType } from 'type-graphql';

// CREATE TOKEN
@InputType()
export class CreateTokenInputDto {
  @Field(type => String)
  header: string;
}

@ObjectType()
export class CreateTokenOutputDto {
  @Field(type => String)
  token: string;
}

// LOGIN USER
@InputType()
export class LoginUserInputDto {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
export class LoginUserOutputDto {
  @Field()
  success: boolean;
}
