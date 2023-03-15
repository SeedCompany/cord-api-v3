import { Field, InterfaceType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { DbLabel, ID, Resource, SecuredProps } from '~/common';
import { BaseNode } from '~/core/database/results';
import { IEngagement } from '../../dto';
import { OutcomeHistory } from './outcome-history';

@InterfaceType({
  implements: [Resource],
})
export class Outcome extends Resource {
  static readonly Props: string[] = keysOf<Outcome>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Outcome>>();
  static readonly Parent = import('../../dto').then((m) => m.IEngagement);

  readonly __typename: 'Outcome';

  readonly engagement: ID;

  @Field({ nullable: true })
  readonly description: string;

  @Field(() => IEngagement)
  readonly parent: BaseNode;

  @Field(() => [OutcomeHistory], { nullable: true })
  @DbLabel('OutcomeHistory')
  readonly history: OutcomeHistory[];
}
