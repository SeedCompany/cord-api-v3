import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredBoolean, SecuredString } from '../../../common';
import { Producible, ProducibleType } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    Story = 'Story',
  }
}

Object.assign(ProducibleType, { Story: 'Story' });

@ObjectType({
  implements: [Producible, Resource],
})
export class Story extends Producible {
  @Field()
  readonly name: SecuredString;

  readonly canDelete: SecuredBoolean;
}
