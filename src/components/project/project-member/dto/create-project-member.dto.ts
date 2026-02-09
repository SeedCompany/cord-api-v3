import { Field, InputType } from '@nestjs/graphql';
import type { DateTime } from 'luxon';
import {
  DateTimeField,
  type ID,
  IdField,
  Role,
  type UnsecuredDto,
} from '~/common';
import { type Project } from '../../dto';

@InputType()
export class CreateProjectMember {
  @IdField({
    description: 'A user ID',
  })
  readonly user: ID<'User'>;

  @IdField({
    description: 'A project ID',
  })
  readonly project: ID<'Project'> | UnsecuredDto<Project>;

  @Field(() => [Role], { nullable: true })
  readonly roles?: readonly Role[];

  @DateTimeField({
    nullable: true,
  })
  readonly inactiveAt?: DateTime | null;
}
