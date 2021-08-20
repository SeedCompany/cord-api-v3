import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  NameField,
  Resource,
  SecuredProps,
  SecuredString,
} from '../../../common';
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
  static readonly Props = keysOf<Song>();
  static readonly SecuredProps = keysOf<SecuredProps<Song>>();

  @NameField()
  @DbLabel('SongName')
  readonly name: SecuredString;
}
