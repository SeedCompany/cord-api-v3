import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, type UnsecuredDto } from '~/common';
import { type LinkTo, RegisterResource } from '~/core';
import { e } from '~/core/gel';
import { type User } from '../../../user/dto';
import { ProjectType } from '../../dto';

@RegisterResource({
  db: e.Project.FinancialApprover,
})
@ObjectType('ProjectTypeFinancialApprover')
export class FinancialApprover {
  readonly user: LinkTo<'User'> & Pick<UnsecuredDto<User>, 'email'>;

  @Field(() => [ProjectType])
  readonly projectTypes: readonly [ProjectType, ...ProjectType[]];
}

@InputType('ProjectTypeFinancialApproverInput')
export abstract class FinancialApproverInput {
  @IdField()
  readonly user: ID<'User'>;

  @Field(() => [ProjectType])
  readonly projectTypes: readonly [ProjectType, ...ProjectType[]];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    FinancialApprover: typeof FinancialApprover;
  }
  interface ResourceDBMap {
    FinancialApprover: typeof e.Project.FinancialApprover;
  }
}
