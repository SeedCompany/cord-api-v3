import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps, UnsecuredDto } from '~/common';
import { LinkTo, RegisterResource } from '~/core';
import { e } from '~/core/edgedb';
import { User } from '../../../user';
import { ProjectType } from '../../dto';

@RegisterResource({
  db: e.Project.FinancialApprover,
})
@ObjectType({
  implements: [Resource],
})
export class ProjectTypeFinancialApprover extends Resource {
  static readonly Props: string[] = keysOf<ProjectTypeFinancialApprover>();
  static readonly SecuredProps =
    keysOf<SecuredProps<ProjectTypeFinancialApprover>>();

  readonly user: LinkTo<'User'> & Pick<UnsecuredDto<User>, 'email'>;

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
