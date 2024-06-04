import { Field, InterfaceType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';

@InterfaceType({
  description: 'An item that can be pinned',
})
export class Pinnable {
  @IdField()
  readonly id: ID;

  @Field({
    description: 'Does the requesting user have this pinned?',
  })
  pinned: boolean;
}
