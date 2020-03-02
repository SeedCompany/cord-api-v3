import { registerEnumType } from 'type-graphql';

export enum ProjectType {
  Translation = 'translation',
  Internship = 'internship',
}

registerEnumType(ProjectType, {
  name: 'ProjectType',
});
