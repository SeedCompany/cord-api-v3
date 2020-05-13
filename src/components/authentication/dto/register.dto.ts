import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { CreatePerson, User } from '../../user';

@InputType()
export abstract class RegisterInput extends CreatePerson {
  @Field()
  readonly email: string;

  @Field()
  readonly password: string;
}

@ObjectType()
export abstract class RegisterOutput {
  @Field()
  readonly user: User;
}
