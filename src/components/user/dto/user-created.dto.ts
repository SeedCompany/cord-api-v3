import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.dto';

@ObjectType()
export abstract class UserCreated {
  @Field()
  readonly user: User; // intentionally user
}
