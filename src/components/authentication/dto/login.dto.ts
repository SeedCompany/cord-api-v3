import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { EmailField, ID } from '~/common';

@InputType()
export abstract class LoginInput {
  @EmailField()
  email: string;

  @Field()
  password: string;
}

@ObjectType()
export class LoginOutput {
  user: ID;
}
