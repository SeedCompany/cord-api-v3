import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  Resource,
  SecuredProps,
  SecuredRichText,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class Comment extends Resource {
  static readonly Props = keysOf<Comment>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Comment>>();

  readonly thread: ID;

  readonly creator: ID;

  @Field()
  readonly body: SecuredRichText;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
