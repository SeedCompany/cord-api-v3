import { registerEnumType } from '@nestjs/graphql';

export enum ProjectType {
  Translation = 'Translation',
  Internship = 'Internship',
}

registerEnumType(ProjectType, {
  name: 'ProjectType',
});
