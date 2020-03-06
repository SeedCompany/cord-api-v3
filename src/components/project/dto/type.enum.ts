import { registerEnumType } from 'type-graphql';

export enum ProjectType {
  Translation = 'Translation',
  Internship = 'Internship',
}

registerEnumType(ProjectType, {
  name: 'ProjectType',
});
