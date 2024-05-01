import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, IdField } from '~/common';
import { LinkTo, RegisterResource } from '~/core';
import { e } from '~/core/edgedb';
import { User } from '../../user';
import { ProjectType } from '../dto';

@RegisterResource({
  db: e.Project.FinancialApprover,
})
@ObjectType()
export class ProjectTypeFinancialApprover {
  static readonly Props: string[] = keysOf<ProjectTypeFinancialApprover>();
  static readonly SecuredProps: string[] = [];

  @Field(() => User)
  readonly user: LinkTo<'User'>;

  @Field(() => [ProjectType])
  readonly projectTypes: readonly ProjectType[];
}

@InputType()
export class ProjectTypeFinancialApproverInput {
  @IdField()
  readonly user: ID<'User'>;

  @Field(() => [ProjectType])
  readonly projectTypes: readonly ProjectType[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProjectTypeFinancialApprover: typeof ProjectTypeFinancialApprover;
  }
  interface ResourceDBMap {
    ProjectTypeFinancialApprover: typeof e.Project.FinancialApprover;
  }
}

// projectTypeFinancialApprovers -> ProjectTypeFinancialApprover[]
// updateProjectTypeFinancialApprover -> ProjectTypeFinancialApprover?
