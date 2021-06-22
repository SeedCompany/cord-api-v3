import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { ProjectChangeRequestType } from './project-change-request-type.enum';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class CreateProjectChangeRequest {
  @IdField({
    description: 'A project ID',
  })
  readonly projectId: ID;

  @Field(() => [ProjectChangeRequestType])
  readonly types: ProjectChangeRequestType[];

  @Field()
  readonly summary: string;
}

@InputType()
export abstract class CreateProjectChangeRequestInput {
  @Field()
  @Type(() => CreateProjectChangeRequest)
  @ValidateNested()
  readonly projectChangeRequest: CreateProjectChangeRequest;
}

@ObjectType()
export abstract class CreateProjectChangeRequestOutput {
  @Field(() => ProjectChangeRequest)
  readonly projectChangeRequest: ProjectChangeRequest;
}
