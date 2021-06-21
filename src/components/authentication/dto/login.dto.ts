import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { toLower } from 'lodash';
import { ID, IsEmail } from '../../../common';

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
  user: ID;
}
