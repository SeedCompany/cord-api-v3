import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString } from '../../../common';
import { Producible } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    Story = 'Story',
  }
}

@ObjectType({
  implements: [Producible, Resource],
})
export class Story extends Producible {
  @Field()
  readonly name: SecuredString;
}
