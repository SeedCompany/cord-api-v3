import { Field, ObjectType } from '@nestjs/graphql';
import { setOf } from '@seedcompany/common';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type EngagementStatus = EnumType<typeof EngagementStatus>;
export const EngagementStatus = makeEnum({
  name: 'EngagementStatus',
  values: [
    'InDevelopment',
    { value: 'DidNotDevelop', terminal: true },
    { value: 'Rejected', terminal: true },

    'Active',

    'DiscussingTermination',
    'DiscussingReactivation',
    'DiscussingChangeToPlan',
    'DiscussingSuspension',

    'FinalizingCompletion',
    'ActiveChangedPlan',
    'Suspended',

    { value: 'Terminated', terminal: true },
    { value: 'Completed', terminal: true },

    ...(['Converted', 'Unapproved', 'Transferred', 'NotRenewed'] as const).map(
      (value) => ({
        value,
        terminal: true,
        deprecationReason: 'Legacy. Only used in historic data.',
      }),
    ),
  ],
  extra: ({ entries }) => ({
    Terminal: setOf(entries.flatMap((v) => (v.terminal ? [v.value] : []))),
    Ongoing: setOf(entries.flatMap((v) => (!v.terminal ? [v.value] : []))),
  }),
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an engagement status'),
})
export class SecuredEngagementStatus extends SecuredEnum(EngagementStatus) {}

export type EngagementTransitionType = EnumType<
  typeof EngagementTransitionType
>;
export const EngagementTransitionType = makeEnum({
  name: 'EngagementTransitionType',
  values: ['Neutral', 'Approve', 'Reject'],
});

@ObjectType()
export abstract class EngagementStatusTransition {
  @Field(() => EngagementStatus)
  to: EngagementStatus;

  @Field()
  label: string;

  @Field(() => EngagementTransitionType)
  type: EngagementTransitionType;
}
