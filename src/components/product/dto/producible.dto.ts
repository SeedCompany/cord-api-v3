import { Field, InterfaceType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { type MadeEnum } from '@seedcompany/nest';
import { stripIndent } from 'common-tags';
import {
  type EnumType,
  lazyRef,
  makeEnum,
  Resource,
  SecuredProperty,
  type UnsecuredDto,
} from '~/common';
import { type SetDbType } from '~/core/database';
import { type SetChangeType } from '~/core/database/changes';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { type DbScriptureReferences } from '../../scripture';
import { type ScriptureRangeInput, SecuredScriptureRanges } from '../../scripture/dto';

@RegisterResource({ db: e.Producible })
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
  @Field(() => SecuredScriptureRanges)
  readonly scriptureReferences: SecuredScriptureRanges &
    SetDbType<DbScriptureReferences | readonly ScriptureRangeInput[]> &
    SetChangeType<'scriptureReferences', readonly ScriptureRangeInput[]>;
}

// Augment this with each implementation of Producible via declaration merging
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ProducibleTypeEntries {}
export const ProducibleTypeEntries = new Set<string>();

export type ProducibleType = EnumType<typeof ProducibleType>;
export const ProducibleType = lazyRef(
  (): MadeEnum<keyof ProducibleTypeEntries> =>
    (realProducibleType ??= makeEnum({
      values: ProducibleTypeEntries as Iterable<keyof ProducibleTypeEntries>,
    })),
);
let realProducibleType: MadeEnum<keyof ProducibleTypeEntries> | undefined;
// Register proxy eagerly to GQL schema
registerEnumType(ProducibleType, { name: 'ProducibleType' });

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
  interface ResourceDBMap {
    Producible: typeof e.default.Producible;
  }
}
