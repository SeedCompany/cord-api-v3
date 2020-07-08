import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsLength } from '../../../common';
import { CreatePerson, User } from '../../user';

@InputType()
export abstract class RegisterInput extends CreatePerson {
  @Field()
  readonly email: string;

  @Field()
  @IsLength()
  readonly password: string;
}

@ObjectType()
export abstract class RegisterOutput {
  @Field()
  readonly user: User;
}
