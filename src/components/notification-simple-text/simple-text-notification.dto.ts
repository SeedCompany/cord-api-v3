import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { LinkTo } from '~/core/resources';
import { Notification } from '../notifications';

@ObjectType({
  implements: [Notification],
})
export class SimpleTextNotification extends Notification {
  static readonly Props = keysOf<SimpleTextNotification>();
  static readonly SecuredProps = keysOf<SecuredProps<SimpleTextNotification>>();

  @Field(() => String)
  readonly content: string;

  // Here to demonstrate relationships in DB & GQL
  readonly reference: LinkTo<'User'> | null;
}
