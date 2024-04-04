import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredProps,
  SecuredString,
} from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { Producible } from '../../product/dto/producible.dto';

declare module '../../product/dto/producible.dto' {
  interface ProducibleTypeEntries {
    Film: true;
  }
}

@RegisterResource({ db: e.Film })
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
  interface ResourceDBMap {
    Film: typeof e.default.Film;
  }
}
