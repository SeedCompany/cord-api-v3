import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { Producible } from '../../product/dto/producible.dto';

declare module '../../product/dto/producible.dto' {
  interface ProducibleTypeEntries {
    Film: true;
  }
}

@RegisterResource()
@ObjectType({
  implements: [Producible, Resource],
})
export class Film extends Producible {
  static readonly DB = e.Film;
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
