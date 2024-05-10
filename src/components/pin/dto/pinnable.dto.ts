import { Field, InterfaceType } from '@nestjs/graphql';
import { keys } from 'ts-transformer-keys';
import { ID, IdField } from '../../../common';

@InterfaceType({
  description: 'An item that can be pinned',
})
export class Pinnable {
  static readonly Props = keys<Pinnable>();
  static readonly SecuredProps = keys<Pinnable>();

  @IdField()
  readonly id: ID;

  @Field({
    description: 'Does the requesting user have this pinned?',
  })
  pinned: boolean;
}
