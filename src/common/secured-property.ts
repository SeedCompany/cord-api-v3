import { stripIndent } from 'common-tags';
import { GraphQLScalarType, GraphQLString } from 'graphql';
import { isObject } from 'lodash';
import { ClassType, Field, Int, ObjectType } from 'type-graphql';
import { Editable } from './editable.interface';
import { Readable } from './readable.interface';
import { AbstractClassType } from './types';

export interface Secured<T> {
  readonly value?: T;
  readonly canRead: boolean;
  readonly canEdit: boolean;
}

export type UnwrapSecured<T> = T extends Secured<infer P> ? P : T;

export const isSecured = <T>(value: T | Secured<T>): value is Secured<T> =>
  isObject(value);

export const unwrapSecured = <T>(value: T | Secured<T>): T =>
  isSecured(value) ? value.value : value;

export function SecuredProperty<T>(
  ValueClass: ClassType<T> | AbstractClassType<T> | GraphQLScalarType,
) {
  @ObjectType({ isAbstract: true, implements: [Readable, Editable] })
  abstract class SecuredPropertyClass
    implements Readable, Editable, Secured<T> {
    @Field(() => ValueClass, { nullable: true })
    readonly value?: T;
    @Field()
    readonly canRead: boolean;
    @Field()
    readonly canEdit: boolean;
  }

  return SecuredPropertyClass;
}

SecuredProperty.descriptionFor = (value: string) => stripIndent`
  An object with ${value} \`value\` and additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is \`null\`.
  These \`can*\` authorization properties are specific to the user making the request.
`;

@ObjectType({
  description: SecuredProperty.descriptionFor('a string'),
})
export abstract class SecuredString extends SecuredProperty<string>(
  GraphQLString,
) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('an integer'),
})
export abstract class SecuredInt extends SecuredProperty<number>(Int) {}
