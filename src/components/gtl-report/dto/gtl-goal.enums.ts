import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

/**
 * How a goal's completion is measured.
 *
 * The same three axes the Growth Partners Activity uses on the other branch.
 * Keeping the two features' vocabulary identical matters more than inventing a
 * better one here — a Field Ops manager should not have to learn two.
 */
export type GtlGoalMeasurement = EnumType<typeof GtlGoalMeasurement>;
export const GtlGoalMeasurement = makeEnum({
  name: 'GtlGoalMeasurement',
  values: [
    { value: 'Number', label: 'Count toward a target' },
    { value: 'Percent', label: 'Percent complete' },
    { value: 'Boolean', label: 'Done / Not done' },
  ],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('GTL goal measurement'),
})
export abstract class SecuredGtlGoalMeasurement extends SecuredEnum(
  GtlGoalMeasurement,
) {}

export type GtlGoalStatus = EnumType<typeof GtlGoalStatus>;
export const GtlGoalStatus = makeEnum({
  name: 'GtlGoalStatus',
  values: [
    { value: 'Planned', label: 'To do' },
    { value: 'InProgress', label: 'In progress' },
    { value: 'AtRisk', label: 'At risk' },
    { value: 'OnHold', label: 'On hold' },
    'Done',
    'Cancelled',
  ],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('GTL goal status'),
})
export abstract class SecuredGtlGoalStatus extends SecuredEnum(GtlGoalStatus) {}

/**
 * Whether a goal is tracking against its target date. Computed, never stored.
 */
export type GtlGoalScheduleStatus = EnumType<typeof GtlGoalScheduleStatus>;
export const GtlGoalScheduleStatus = makeEnum({
  name: 'GtlGoalScheduleStatus',
  values: [
    { value: 'Ahead', label: 'Ahead of schedule' },
    { value: 'OnTime', label: 'On time' },
    'Behind',
  ],
  exposeOrder: true,
});
