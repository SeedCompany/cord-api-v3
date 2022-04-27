import { registerEnumType } from '@nestjs/graphql';

export enum PostShareability {
  Membership = 'Membership',
  ProjectTeam = 'ProjectTeam',
  Internal = 'Internal',
  AskToShareExternally = 'AskToShareExternally',
  External = 'External',
}

registerEnumType(PostShareability, {
  name: 'PostShareability',
  valuesMap: {
    ProjectTeam: {
      deprecationReason: 'Use `Membership` instead',
      description: `@label Team Members`,
    },
    Membership: {
      description: `@label Team Members`,
    },
  },
});
