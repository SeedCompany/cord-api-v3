import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Resource,
  SecuredEnum,
  SecuredKeys,
  SecuredProperty,
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
  @Field()
  readonly degree: SecuredDegree;

  @Field()
  readonly major: SecuredString;

  @Field()
  readonly institution: SecuredString;
}

declare module '../../../authorization/policies/mapping' {
  interface TypeToDto {
    Education: Education;
  }
  interface TypeToSecuredProps {
    Education: SecuredKeys<Education>;
  }
}
