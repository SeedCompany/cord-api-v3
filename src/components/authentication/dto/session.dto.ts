import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, Session } from '~/common';

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

  // Current user ID if any
  user?: ID;

  session: Session;
}
