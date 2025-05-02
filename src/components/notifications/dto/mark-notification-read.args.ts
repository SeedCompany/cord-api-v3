import { ArgsType, Field } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';

@ArgsType()
export abstract class MarkNotificationReadArgs {
  @IdField()
  readonly id: ID<'Notification'>;

  @Field(() => Boolean, { nullable: true })
  readonly unread = false;
}
