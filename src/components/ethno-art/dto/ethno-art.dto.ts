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
    EthnoArt = 'EthnoArt',
  }
}

Object.assign(ProducibleType, { EthnoArt: 'EthnoArt' });

@RegisterResource()
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
}
