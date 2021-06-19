import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Powers } from '../../authorization';
import { User } from '../../user';

@ObjectType()
export abstract class SessionOutput {
  @Field({
    nullable: true,
    description: stripIndent`
      Use this token in future requests in the Authorization header.
      Authorization: Bearer {token}.
      This token is only returned when the \`browser\` argument is not set to \`true\`.`,
  })
  token?: string;

  @Field(() => User, {
    nullable: true,
    description:
      'Only returned if there is a logged-in user tied to the current session.',
  })
  user: User | null;

  @Field(() => [Powers], { nullable: true })
  readonly powers: Powers[];
}
