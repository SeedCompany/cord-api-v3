import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredString } from '../../../common';
import { Producible, ProducibleType } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    Song = 'Song',
  }
}

Object.assign(ProducibleType, { Song: 'Song' });

@ObjectType({
  implements: [Producible, Resource],
})
export class Song extends Producible {
  static readonly Props = keysOf<Song>();

  @Field()
  readonly name: SecuredString;
}
