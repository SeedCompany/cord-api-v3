import { registerEnumType } from 'type-graphql';

export enum ProjectEngagementTag {
  LukePartnership = 'luke_partnership',
  FirstScripture = 'first_scripture',
  CeremonyPlanned = 'ceremony_planned',
}

registerEnumType(ProjectEngagementTag, { name: 'ProjectEngagementTag' });
