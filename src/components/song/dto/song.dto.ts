import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString } from '../../../common';
import { Producible } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    Song = 'Song',
  }
}

@ObjectType({
  implements: [Producible, Resource],
})
export class Song extends Producible {
  @Field()
  readonly name: SecuredString;
}
