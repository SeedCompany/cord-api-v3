import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { MarkdownScalar } from '~/common/markdown.scalar';
import { Notification } from '../notifications';

@ObjectType({
  implements: [Notification],
})
export class SystemNotification extends Notification {
  static readonly Props = keysOf<SystemNotification>();
  static readonly SecuredProps = keysOf<SecuredProps<SystemNotification>>();

  @Field(() => MarkdownScalar)
  readonly message: string;
}
