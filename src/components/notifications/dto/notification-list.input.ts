import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, PaginationInput } from '~/common';
import { Notification } from './notification.dto';

@InputType()
export abstract class NotificationFilters {
  @Field(() => Boolean, {
    description: 'Only read/unread notifications',
    nullable: true,
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
