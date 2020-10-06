import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredKeys, SecuredString } from '../../../common';
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

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Film: Film;
  }
  interface TypeToSecuredProps {
    Film: SecuredKeys<Film>;
  }
}
