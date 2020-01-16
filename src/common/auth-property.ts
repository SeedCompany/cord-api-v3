import { GraphQLScalarType, GraphQLString } from 'graphql';
import { ClassType, Field, Int, ObjectType } from 'type-graphql';

export function AbstractAuthProperty<T>(
  ItemClass: ClassType<T> | GraphQLScalarType,
) {
  @ObjectType({ isAbstract: true })
  abstract class AbstractAuthPropertyClass {
    @Field(() => ItemClass, { nullable: true })
    value: T | null;
    @Field()
    canRead: boolean;
    @Field()
    canEdit: boolean;
  }

  return AbstractAuthPropertyClass;
}

@ObjectType()
export class StringAuthProperty extends AbstractAuthProperty<string>(
  GraphQLString,
) {
  static from(props: StringAuthProperty) {
    return Object.assign(new StringAuthProperty(), props);
  }
}

@ObjectType()
export class IntAuthProperty extends AbstractAuthProperty<number>(Int) {
  static from(props: IntAuthProperty) {
    return Object.assign(new IntAuthProperty(), props);
  }
}
