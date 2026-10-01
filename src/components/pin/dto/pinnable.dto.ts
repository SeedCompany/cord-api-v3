import { Field, InterfaceType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';

@InterfaceType({
  description: 'An item that can be pinned',
})
// Maintaining previous functionality.
// This could be removed (and data migrated) to query it.
export class Pinnable {
  @IdField()
  readonly id: ID;

  @Field({
    description: 'Does the requesting user have this pinned?',
  })
  pinned: boolean;
}
