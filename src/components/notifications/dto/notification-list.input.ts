import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { FilterField, OptionalField, PaginatedList, PaginationInput } from '~/common';
import { Notification } from './notification.dto';

@InputType()
export abstract class NotificationFilters {
  @OptionalField(() => Boolean, {
    description: 'Only read/unread notifications',
  })
  readonly unread?: boolean;
}

@InputType()
export class NotificationListInput extends PaginationInput {
  @FilterField(() => NotificationFilters)
  readonly filter?: NotificationFilters;
}

@ObjectType()
export class NotificationList extends PaginatedList(Notification) {
  @Field(() => Int, {
    description: 'The total number of unread notifications',
  })
  readonly totalUnread: number;
}
