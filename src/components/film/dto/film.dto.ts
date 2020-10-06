import { Field, ObjectType } from '@nestjs/graphql';
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
  @Field()
  readonly name: SecuredString;
}
