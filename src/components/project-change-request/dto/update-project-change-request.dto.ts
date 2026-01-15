import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type NonEmptyArray } from '@seedcompany/common';
import {
  type ID,
  IdField,
  ListField,
  NameField,
  OptionalField,
} from '~/common';
import { ProjectChangeRequestStatus } from './project-change-request-status.enum';
import { ProjectChangeRequestType } from './project-change-request-type.enum';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class UpdateProjectChangeRequest {
  @IdField()
  readonly id: ID;

  @ListField(() => ProjectChangeRequestType, { optional: true, empty: 'deny' })
  readonly types?: NonEmptyArray<ProjectChangeRequestType>;

  @NameField({ optional: true })
  readonly summary?: string;

  @OptionalField(() => ProjectChangeRequestStatus)
  readonly status?: ProjectChangeRequestStatus;
}

@ObjectType()
export abstract class UpdateProjectChangeRequestOutput {
  @Field()
  readonly projectChangeRequest: ProjectChangeRequest;
}
