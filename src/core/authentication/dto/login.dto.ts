import { ObjectType } from '@nestjs/graphql';
import { type ID } from '~/common';

@ObjectType()
export class LoggedIn {
  user: ID;
}
