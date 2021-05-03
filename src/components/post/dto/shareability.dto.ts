import { registerEnumType } from '@nestjs/graphql';

export enum PostShareability {
  ProjectTeam = 'ProjectTeam',
  Internal = 'Internal',
  AskToSharePublicly = 'AskToSharePublicly',
  Public = 'Public',
}

registerEnumType(PostShareability, {
  name: 'PostShareability',
});
