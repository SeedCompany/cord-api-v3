import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredString } from '../../../common';
import { Producible, ProducibleType } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    Film = 'Film',
  }
}

Object.assign(ProducibleType, { Film: 'Film' });

@ObjectType({
  implements: [Producible, Resource],
})
export class Film extends Producible {
  static readonly Props = keysOf<Film>();

  @Field()
  readonly name: SecuredString;
}
