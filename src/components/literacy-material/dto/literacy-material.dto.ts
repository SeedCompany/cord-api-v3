import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
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
    LiteracyMaterial = 'LiteracyMaterial',
  }
}

Object.assign(ProducibleType, { LiteracyMaterial: 'LiteracyMaterial' });

@ObjectType({
  implements: [Producible, Resource],
})
export class LiteracyMaterial extends Producible {
  static readonly Props = keysOf<LiteracyMaterial>();
  static readonly SecuredProps = keysOf<SecuredProps<LiteracyMaterial>>();

  @NameField()
  @DbUnique('LiteracyName')
  readonly name: SecuredString;
}
