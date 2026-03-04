import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

export type ToolKey = EnumType<typeof ToolKey>;
export const ToolKey = makeEnum({
  name: 'ToolKey',
  values: ['Rev79'],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('tool key'),
})
export abstract class SecuredToolKey extends SecuredEnum(ToolKey, {
  nullable: true,
}) {}
