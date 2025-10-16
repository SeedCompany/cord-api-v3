import { Field, ObjectType } from '@nestjs/graphql';
import { Notification } from './notification.dto';

/**
 * The broadcast event & GQL don't have to share the same type/shape.
 * But it makes sense here.
 * Normally data would need to be re-loaded with the receiver's permissions.
 */
@ObjectType()
export class NotificationAdded {
  @Field()
  readonly notification: Notification;
}
