import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { type ID } from '~/common';
import { CreatePerson } from '../../../components/user/dto/create-person.dto';

@InputType()
export abstract class RegisterUser extends CreatePerson {
  @Field()
  declare readonly email: string;

  @Field()
  @MinLength(6)
  readonly password: string;
}

@ObjectType()
export abstract class RegisterOutput {
  readonly user: ID;
}
