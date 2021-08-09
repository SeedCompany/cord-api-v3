import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProperty, SecuredProps } from '../../../common';
import { SecuredScriptureRanges } from '../../scripture/dto';

@InterfaceType({
  description: 'Something that is _producible_ via a Product',
  resolveType: (p: ProducibleResult) => p.__typename,
  implements: [Resource],
})
@ObjectType({
  isAbstract: true,
  implements: [Resource],
})
export abstract class Producible extends Resource {
  static readonly Props: string[] = keysOf<Producible>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Producible>>();

  @Field()
  readonly scriptureReferences: SecuredScriptureRanges;
}

// Augment this enum with each implementation of Producible
// via declaration merging
export enum ProducibleType {}

export type ProducibleResult = Producible & {
  __typename: ProducibleType;
};

@ObjectType({
  description: SecuredProperty.descriptionFor('a producible'),
})
export class SecuredProducible extends SecuredProperty<
  Producible,
  ProducibleResult
>(Producible) {}
