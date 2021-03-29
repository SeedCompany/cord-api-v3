import { registerEnumType } from '@nestjs/graphql';

export enum PostType {
  Note = 'Note',
  Story = 'Story',
  Prayer = 'Prayer',
}

registerEnumType(PostType, {
  name: 'PostType',
});
