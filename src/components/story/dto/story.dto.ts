import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core/resources';
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
    Story = 'Story',
  }
}

Object.assign(ProducibleType, { Story: 'Story' });

@RegisterResource()
@ObjectType({
  implements: [Producible, Resource],
})
export class Story extends Producible {
  static readonly Props = keysOf<Story>();
  static readonly SecuredProps = keysOf<SecuredProps<Story>>();

  @NameField()
  @DbUnique()
  readonly name: SecuredString;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Story: typeof Story;
  }
}
