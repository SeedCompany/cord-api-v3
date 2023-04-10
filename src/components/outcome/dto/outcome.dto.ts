import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { IdOf, Resource, SecuredProps, SecuredRichText } from '~/common';
import { RegisterResource } from '~/core';
import { LanguageEngagement } from '../../engagement/dto';
import { OutcomeHistory } from './outcome-history.dto';

@ObjectType({
  implements: [Resource],
})
@RegisterResource()
export class Outcome extends Resource {
  static readonly Props = keysOf<Outcome>();
  static readonly SecuredProps = keysOf<SecuredProps<Outcome>>();
  static readonly Parent = import('../../engagement/dto').then(
    (m) => m.IEngagement,
  );

  readonly __typename: 'Outcome';

  readonly engagement: IdOf<LanguageEngagement>;

  @Field()
  readonly description: SecuredRichText;

  @Field(() => [OutcomeHistory], { nullable: true })
  readonly history: OutcomeHistory[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Outcome: typeof Outcome;
  }
}
