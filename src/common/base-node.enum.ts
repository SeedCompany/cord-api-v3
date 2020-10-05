import { registerEnumType } from '@nestjs/graphql';

export enum BaseNodeEnum {
  Project = 'Project',
  Language = 'Language',
  Organization = 'Organization',
  Location = 'Location',
  Film = 'Film',
  Story = 'Story',
  LiteracyMaterial = 'LiteracyMaterial',
  User = 'User',
}

registerEnumType(BaseNodeEnum, {
  name: 'BaseNodeEnum',
});
