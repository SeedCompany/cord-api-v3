import { Field, ObjectType } from '@nestjs/graphql';
import {
  type EnumType,
  makeEnum,
  NameField,
  Resource,
  SecuredEnum,
  SecuredProperty,
  SecuredString,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';

export type Degree = EnumType<typeof Degree>;
export const Degree = makeEnum({
  name: 'Degree',
  values: [
    'Primary',
    'Secondary',
    'Associates',
    'Bachelors',
    'Masters',
    'Doctorate',
  ],
});

@ObjectType({
  description: SecuredProperty.descriptionFor('a degree'),
})
export abstract class SecuredDegree extends SecuredEnum(Degree) {}

@RegisterResource({ db: e.User.Education })
@ObjectType({
  implements: [Resource],
})
export class Education extends Resource {
  static readonly Parent = () => import('../../dto').then((m) => m.User);

  @Field()
  readonly degree: SecuredDegree;

  @NameField()
  readonly major: SecuredString;

  @NameField()
  readonly institution: SecuredString;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Education: typeof Education;
  }
  interface ResourceDBMap {
    Education: typeof e.User.Education;
  }
}
