import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { stripIndent } from 'common-tags';
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

@ObjectType({
  description: stripIndent`
    A user/person was anonymously "self" created with their login credentials.
  `,
})
export abstract class UserRegistered {
  readonly user: ID;
}
