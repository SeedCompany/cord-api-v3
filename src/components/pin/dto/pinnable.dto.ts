import { Field, InterfaceType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InterfaceType({
  description: 'An item that can be pinned',
})
export class Pinnable {
  @IdField()
  readonly id: string;

  @Field({
    description: 'Does the requesting user have this pinned?',
  })
  pinned: boolean;
}
