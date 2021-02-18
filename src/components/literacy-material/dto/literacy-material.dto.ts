import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredBoolean, SecuredString } from '../../../common';
import { Producible, ProducibleType } from '../../product/dto';

declare module '../../product/dto' {
  enum ProducibleType {
    LiteracyMaterial = 'LiteracyMaterial',
  }
}

Object.assign(ProducibleType, { LiteracyMaterial: 'LiteracyMaterial' });

@ObjectType({
  implements: [Producible, Resource],
})
export class LiteracyMaterial extends Producible {
  @Field()
  readonly name: SecuredString;

  readonly canDelete: SecuredBoolean;
}
