import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredBoolean, SecuredString } from '../../../common';
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
  @Field()
  readonly name: SecuredString;

  readonly canDelete: SecuredBoolean;
}
