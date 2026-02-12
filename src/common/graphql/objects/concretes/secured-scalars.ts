import { Float, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLBoolean, GraphQLString } from 'graphql';
import {
  SecuredProperty,
  SecuredPropertyList,
} from '../abstracts/secured-property';

@ObjectType({
  description: SecuredProperty.descriptionFor('a string or null'),
})
export abstract class SecuredStringNullable extends SecuredProperty<
  string,
  string,
  true
>(GraphQLString, {
  nullable: true,
}) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a string'),
})
export abstract class SecuredString extends SecuredProperty<string>(
  GraphQLString,
) {}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('strings'),
})
export abstract class SecuredStringList extends SecuredPropertyList<string>(
  GraphQLString,
) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('an integer'),
})
export abstract class SecuredInt extends SecuredProperty<number>(Int) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('an integer or null'),
})
export abstract class SecuredIntNullable extends SecuredProperty<
  number,
  number,
  true
>(Int, {
  nullable: true,
}) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a float'),
})
export abstract class SecuredFloat extends SecuredProperty<number>(Float) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a float or null'),
})
export abstract class SecuredFloatNullable extends SecuredProperty<
  number,
  number,
  true
>(Float, { nullable: true }) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a boolean'),
})
export abstract class SecuredBoolean extends SecuredProperty<boolean>(
  GraphQLBoolean,
) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a boolean or null'),
})
export abstract class SecuredBooleanNullable extends SecuredProperty<
  boolean,
  boolean,
  true
>(GraphQLBoolean, {
  nullable: true,
}) {}
