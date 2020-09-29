import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredKeys, SecuredString } from '../../../common';
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
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Song: Song;
  }
  interface TypeToSecuredProps {
    Song: SecuredKeys<Song>;
  }
}
