import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { User } from './user.dto';

@ObjectType({
  description: stripIndent`
    A user/person was created via another logged in user.
    They do not have login credentials set yet.
  `,
})
export abstract class UserCreated {
  @Field()
  readonly user: User; // intentionally user
}
