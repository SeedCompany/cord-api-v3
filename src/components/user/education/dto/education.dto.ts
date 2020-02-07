import { Field, ObjectType } from 'type-graphql';
import {
  Editable,
  Readable,
  Resource,
  SecuredString,
  Secured,
  SecuredProperty,
} from '../../../../common';
import { registerEnumType } from 'type-graphql';
import { GraphQLString } from 'graphql';

export enum Degree {
  Primary = 'primary',
  Secondary = 'secondary',
  Associates = 'associates',
  Bachelors = 'bachelors',
  Masters = 'masters',
  Doctorate = 'doctorate',
}

registerEnumType(Degree, { name: 'Degree' });

@ObjectType({
  description: SecuredProperty.descriptionFor('a string'),
})
export abstract class SecuredDegree extends SecuredProperty<string>(
  GraphQLString,
) {}

@ObjectType()
export class Education extends Resource{
  @Field()
  readonly degree: SecuredDegree;

  @Field()
  readonly major: SecuredString;

  @Field()
  readonly institution: SecuredString;
}
