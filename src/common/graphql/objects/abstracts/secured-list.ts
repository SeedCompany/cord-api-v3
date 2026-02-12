import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type GraphQLScalarType } from 'graphql';
import type { AbstractClass, Class } from 'type-fest';
import {
  type ListOptions,
  PaginatedList,
  type PaginatedListType,
} from './pagination-list';
import { ISecured } from './secured.interface';

export type SecuredListType<T> = PaginatedListType<T> & {
  readonly canRead: boolean;
  readonly canCreate: boolean;
};

export function SecuredList<Type, ListItem = Type>(
  itemClass: Class<Type> | AbstractClass<Type> | GraphQLScalarType,
  options: ListOptions = {},
) {
  @ObjectType({ isAbstract: true, implements: [ISecured] })
  abstract class SecuredListClass
    extends PaginatedList<Type, ListItem>(itemClass, options)
    implements ISecured, SecuredListType<ListItem>
  {
    @Field({
      description: 'Whether the current user can read the list of items',
    })
    readonly canRead: boolean;

    @Field({
      description: `Whether the current user can add items to this list via the appropriate mutation`,
    })
    readonly canCreate: boolean;
  }

  return SecuredListClass;
}

SecuredList.descriptionFor = (value: string) => stripIndent`
  An object whose \`items\` is a list of ${value} and additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is an empty list.
  The \`can*\` properties are specific to the user making the request.
`;

const redacted: SecuredListType<any> = {
  canRead: false,
  canCreate: false,
  items: [],
  total: 0,
  hasMore: false,
};
SecuredList.Redacted = redacted;
