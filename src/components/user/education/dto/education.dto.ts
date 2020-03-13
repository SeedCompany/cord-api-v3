import { Type } from '@nestjs/common';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLString } from 'graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../../common';

export enum Degree {
  Primary = 'Primary',
  Secondary = 'Secondary',
  Associates = 'Associates',
  Bachelors = 'Bachelors',
  Masters = 'Masters',
  Doctorate = 'Doctorate',
}

registerEnumType(Degree, { name: 'Degree' });

@ObjectType({
  description: SecuredProperty.descriptionFor('a string'),
})
export abstract class SecuredDegree extends SecuredProperty<string>(
  GraphQLString
) {}

@ObjectType({
  implements: [Resource],
})
export class Education extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Education as any) as Type<Education>;

  @Field()
  readonly degree: SecuredDegree;

  @Field()
  readonly major: SecuredString;

  @Field()
  readonly institution: SecuredString;
}
