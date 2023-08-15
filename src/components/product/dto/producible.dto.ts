import {
  Field,
  InterfaceType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { SetDbType } from '~/core/database';
import { RegisterResource } from '~/core/resources';
import {
  Resource,
  SecuredProperty,
  SecuredProps,
  UnsecuredDto,
} from '../../../common';
import { SetChangeType } from '../../../core/database/changes';
import {
  DbScriptureReferences,
  ScriptureRangeInput,
  SecuredScriptureRanges,
} from '../../scripture';

@RegisterResource()
@InterfaceType({
  description: 'Something that is _producible_ via a Product',
  resolveType: (p: ProducibleRef) => p.__typename,
  implements: [Resource],
})
@ObjectType({
  isAbstract: true,
  implements: [Resource],
})
export abstract class Producible extends Resource {
  static readonly Props: string[] = keysOf<Producible>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Producible>>();

  @Field(() => SecuredScriptureRanges)
  readonly scriptureReferences: SecuredScriptureRanges &
    SetDbType<DbScriptureReferences> &
    SetChangeType<'scriptureReferences', readonly ScriptureRangeInput[]>;
}

// Augment this enum with each implementation of Producible
// via declaration merging
export enum ProducibleType {
  DirectScriptureProduct = 'DirectScriptureProduct',
  DerivativeScriptureProduct = 'DerivativeScriptureProduct',
  OtherProduct = 'OtherProduct',
}

registerEnumType(ProducibleType, {
  name: 'ProducibleType',
});

export type ProducibleRef = UnsecuredDto<Producible> & {
  __typename: ProducibleType;
};

@ObjectType({
  description: SecuredProperty.descriptionFor('a producible'),
})
export class SecuredProducible extends SecuredProperty(Producible, {
  description: stripIndent`
    The object that this product is producing.
    i.e. A film named "Jesus Film".
  `,
}) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Producible: typeof Producible;
  }
}
