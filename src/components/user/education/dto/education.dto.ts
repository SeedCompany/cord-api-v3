import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  NameField,
  Resource,
  SecuredEnum,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../../common';

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
  description: SecuredProperty.descriptionFor('a degree'),
})
export abstract class SecuredDegree extends SecuredEnum(Degree) {}

@ObjectType({
  implements: [Resource],
})
export class Education extends Resource {
  static readonly Props = keysOf<Education>();
  static readonly SecuredProps = keysOf<SecuredProps<Education>>();

  @Field()
  readonly degree: SecuredDegree;

  @NameField()
  readonly major: SecuredString;

  @NameField()
  readonly institution: SecuredString;
}
