import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredProps,
  SecuredString,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Producible } from '../../product/dto/producible.dto';

declare module '../../product/dto/producible.dto' {
  interface ProducibleTypeEntries {
    EthnoArt: true;
  }
}

@RegisterResource({ db: e.EthnoArt })
@ObjectType({
  implements: [Producible, Resource],
})
export class EthnoArt extends Producible {
  static readonly Props = keysOf<EthnoArt>();
  static readonly SecuredProps = keysOf<SecuredProps<EthnoArt>>();

  @NameField()
  @DbUnique()
  readonly name: SecuredString;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    EthnoArt: typeof EthnoArt;
  }
  interface ResourceDBMap {
    EthnoArt: typeof e.default.EthnoArt;
  }
}
