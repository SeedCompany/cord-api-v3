import { ObjectType } from '@nestjs/graphql';
import { DbUnique, NameField, Resource, SecuredString } from '~/common';
import { RegisterResource } from '~/core/resources';
import {
  Producible,
  ProducibleTypeEntries,
} from '../../product/dto/producible.dto';

ProducibleTypeEntries.add('Film');
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
  @NameField()
  @DbUnique()
  readonly name: SecuredString;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Film: typeof Film;
  }
}
