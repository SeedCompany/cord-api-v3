import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { ID } from '~/common';
import { CreatePerson } from '../../user/dto';

@InputType()
export abstract class RegisterInput extends CreatePerson {
  @Field()
  readonly email: string;

  @Field()
  @MinLength(6)
  readonly password: string;
}

@ObjectType()
export abstract class RegisterOutput {
  readonly user: ID;
}
