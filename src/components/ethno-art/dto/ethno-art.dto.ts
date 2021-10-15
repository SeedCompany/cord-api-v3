import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { Producible, ProducibleType } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    EthnoArt = 'EthnoArt',
  }
}

Object.assign(ProducibleType, { EthnoArt: 'EthnoArt' });

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
