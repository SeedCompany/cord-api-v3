import { CLASS_TYPE_METADATA } from '@nestjs/graphql';
import type { ClassType as ClassTypeVal } from '@nestjs/graphql/dist/enums/class-type.enum';
import { createMetadataDecorator } from '@seedcompany/nest';

export const GqlClassType = createMetadataDecorator({
  key: CLASS_TYPE_METADATA,
  setter: (type: ClassTypeVal) => type,
});
