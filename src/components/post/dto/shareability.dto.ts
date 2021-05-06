import { registerEnumType } from '@nestjs/graphql';

export enum PostShareability {
  ProjectTeam = 'ProjectTeam',
  Internal = 'Internal',
  AskToShareExternally = 'AskToShareExternally',
  External = 'External',
}

registerEnumType(PostShareability, {
  name: 'PostShareability',
});
