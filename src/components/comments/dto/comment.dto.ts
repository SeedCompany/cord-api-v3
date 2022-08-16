import { ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  Resource,
  RichTextField,
  Secured,
  SecuredProps,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class Comment extends Resource {
  static readonly Props = keysOf<Comment>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Comment>>();

  readonly creator: Secured<ID>;

  @RichTextField()
  readonly body: string;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
