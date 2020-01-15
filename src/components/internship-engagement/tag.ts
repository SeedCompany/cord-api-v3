import { registerEnumType } from 'type-graphql';
export enum InternshipEngagementTag {
  CeremonyPlanned = 'ceremony_planned',
}

registerEnumType(InternshipEngagementTag, { name: 'InternshipEngagementTag' });
