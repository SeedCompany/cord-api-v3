import { ObjectType } from '@nestjs/graphql';
import { DbUnique, NameField, Resource, SecuredString } from '~/common';
import { RegisterResource } from '~/core/resources';
import { Producible, ProducibleTypeEntries } from '../../product/dto';

ProducibleTypeEntries.add('Story');
declare module '../../product/dto/producible.dto' {
  interface ProducibleTypeEntries {
    Story: true;
  }
}

@RegisterResource()
@ObjectType({
  implements: [Producible, Resource],
})
export class Story extends Producible {
  @NameField()
  @DbUnique()
  readonly name: SecuredString;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Story: typeof Story;
  }
}
