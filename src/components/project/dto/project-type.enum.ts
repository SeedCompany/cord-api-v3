import { ObjectType } from '@nestjs/graphql';
import {
  type EnumType,
  makeEnum,
  SecuredEnum,
  SecuredEnumList,
} from '~/common';

export type ProjectType = EnumType<typeof ProjectType>;
export const ProjectType = makeEnum({
  name: 'ProjectType',
  values: [
    { value: 'MomentumTranslation', label: 'Momentum' },
    { value: 'MultiplicationTranslation', label: 'Multiplication' },
    // The stored value stays `Internship` — it is a Postgres enum value, a
    // GraphQL enum value, and a discriminator in ~14 app-level literals.
    // Only the display label becomes the program's real name.
    { value: 'Internship', label: 'Global Translation Leaders' },
  ],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('project types'),
})
export abstract class SecuredProjectTypes extends SecuredEnumList(
  ProjectType,
) {}
