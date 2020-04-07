import { stripIndent } from 'common-tags';
import { GraphQLScalarType } from 'graphql';
import { ClassType, Field, ObjectType } from 'type-graphql';
import { ListOptions, PaginatedList } from './pagination-list';
import { Readable } from './readable.interface';
import { AbstractClassType } from './types';

export function SecuredList<Type, ListItem = Type>(
  itemClass: ClassType<Type> | AbstractClassType<Type> | GraphQLScalarType,
  options: ListOptions = {}
) {
  @ObjectType({ isAbstract: true, implements: [Readable] })
  abstract class SecuredListClass
    extends PaginatedList<Type, ListItem>(itemClass, options)
    implements Readable {
    @Field({
      description: 'Whether the current user can read the list of items',
    })
    readonly canRead: boolean;

    @Field({
      description: `Whether the current user can create an ${itemClass.name.toLowerCase()} in this list`,
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
