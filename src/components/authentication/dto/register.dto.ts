import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { Powers } from '../../authorization/dto/powers';
import { CreatePerson, User } from '../../user';

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
  @Field()
  readonly user: User;

  @Field(() => [Powers])
  readonly powers: Powers[];
}
