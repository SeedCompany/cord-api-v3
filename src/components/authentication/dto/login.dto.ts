import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { toLower } from 'lodash';
import { IsEmail } from '../../../common';
import { Powers } from '../../authorization/dto';
import { User } from '../../user/dto';

@InputType()
export abstract class LoginInput {
  @Field()
  @IsEmail()
  @Transform(({ value }) => toLower(value))
  email: string;

  @Field()
  password: string;
}

@ObjectType()
export class LoginOutput {
  @Field({
    description: 'The logged-in user',
  })
  user: User;

  // TODO Global Permissions
  @Field(() => [Powers])
  readonly powers: Powers[];
}
