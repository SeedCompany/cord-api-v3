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
  SecuredRichTextDocument,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class Comment extends Resource {
  static readonly Props = keysOf<Comment>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Comment>>();

  readonly thread: ID;

  readonly creator: Secured<ID>;

  @RichTextField()
  readonly body: SecuredRichTextDocument;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
