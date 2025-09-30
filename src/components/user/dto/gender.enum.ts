import { ObjectType } from '@nestjs/graphql';
import {
  type EnumType,
  makeEnum,
  SecuredEnum,
  SecuredProperty,
} from '~/common';

export type Gender = EnumType<typeof Gender>;
export const Gender = makeEnum({
  name: 'Gender',
  values: ['Male', 'Female'],
});

@ObjectType({
  description: SecuredProperty.descriptionFor('a gender'),
})
export abstract class SecuredGenderNullable extends SecuredEnum(Gender, {
  nullable: true,
}) {}
