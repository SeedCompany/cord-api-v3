import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { Producible, ProducibleType } from '../../product/dto/producible.dto';

declare module '../../product/dto/producible.dto' {
  enum ProducibleType {
    Film = 'Film',
  }
}

Object.assign(ProducibleType, { Film: 'Film' });

@RegisterResource()
@ObjectType({
  implements: [Producible, Resource],
})
export class Film extends Producible {
  static readonly Props = keysOf<Film>();
  static readonly SecuredProps = keysOf<SecuredProps<Film>>();

  @NameField()
  @DbUnique()
  readonly name: SecuredString;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Film: typeof Film;
  }
}
