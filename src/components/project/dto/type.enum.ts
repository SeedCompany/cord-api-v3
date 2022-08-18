import { registerEnumType } from '@nestjs/graphql';

export enum ProjectType {
  Translation = 'Translation',
  Internship = 'Internship',
  Publication = 'Publication',
}

registerEnumType(ProjectType, {
  name: 'ProjectType',
});
