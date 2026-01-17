import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type NonEmptyArray } from '@seedcompany/common';
import { type ID, IdField, ListField, NameField } from '~/common';
import { ProjectChangeRequestType } from './project-change-request-type.enum';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class CreateProjectChangeRequest {
  @IdField({
    description: 'A project ID',
  })
  readonly project: ID<'Project'>;

  @ListField(() => ProjectChangeRequestType, { empty: 'deny' })
  readonly types: NonEmptyArray<ProjectChangeRequestType>;

  @NameField()
  readonly summary: string;
}

@ObjectType()
export abstract class ProjectChangeRequestCreated {
  @Field(() => ProjectChangeRequest)
  readonly projectChangeRequest: ProjectChangeRequest;
}
