import { stripIndent } from 'common-tags';
import { GraphQLScalarType, GraphQLString } from 'graphql';
import { ClassType, Field, Int, ObjectType } from 'type-graphql';

export function SecuredProperty<T>(
  ItemClass: ClassType<T> | GraphQLScalarType,
) {
  @ObjectType({ isAbstract: true })
  abstract class SecuredPropertyClass {
    @Field(() => ItemClass, { nullable: true })
    readonly value?: T;
    @Field()
    readonly canRead: boolean;
    @Field()
    readonly canEdit: boolean;
  }

  return SecuredPropertyClass;
}

const securedDescription = (value: string) => stripIndent`
  An object with ${value} \`value\` and additional authorization information.
  The value is only given if \`canRead\` is \`true\` otherwise it is \`null\`.
  These \`can*\` authorization properties are specific to the user making the request.
`;

@ObjectType({
  description: securedDescription('a string'),
})
export abstract class SecuredString extends SecuredProperty<string>(
  GraphQLString,
) {}

@ObjectType({
  description: securedDescription('an integer'),
})
export abstract class SecuredInt extends SecuredProperty<number>(Int) {}
