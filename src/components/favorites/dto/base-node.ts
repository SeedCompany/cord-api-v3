import { registerEnumType } from '@nestjs/graphql';

export enum BaseNode {
  Project = 'Project',
  Language = 'Language',
  Organization = 'Organization',
  Location = 'Location',
  Film = 'Film',
  Story = 'Story',
  LiteracyMaterial = 'LiteracyMaterial',
  User = 'User',
}

registerEnumType(BaseNode, {
  name: 'BaseNode',
});
