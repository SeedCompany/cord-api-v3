import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { SetRequired } from 'type-fest';
import { Resource, SecuredProperty } from '../../../common';
import { SecuredScriptureRanges } from '../../scripture/dto';

@InterfaceType({
  description: 'Something that is _producible_ via a Product',
  resolveType: (p: ProducibleResult) => p.__typename,
})
@ObjectType({
  isAbstract: true,
  implements: [Resource],
})
export abstract class Producible extends Resource {
  @Field()
  readonly scriptureReferences: SecuredScriptureRanges;
}

// Augment this enum with each implementation of Producible
// via declaration merging
export enum ProducibleType {}

export type ProducibleResult = SetRequired<Partial<Producible>, 'id'> & {
  __typename: ProducibleType;
};

@ObjectType({
  description: SecuredProperty.descriptionFor('a producible'),
})
export class SecuredProducible extends SecuredProperty<
  Producible,
  ProducibleResult
>(Producible) {}
