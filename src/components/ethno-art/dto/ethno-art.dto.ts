import { ObjectType } from '@nestjs/graphql';
import { DbUnique, NameField, Resource, SecuredString } from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import {
  Producible,
  ProducibleTypeEntries,
} from '../../product/dto/producible.dto';

ProducibleTypeEntries.add('EthnoArt');
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
