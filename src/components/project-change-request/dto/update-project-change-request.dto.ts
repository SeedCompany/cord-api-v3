import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { ID, IdField } from '../../../common';
import { Role } from '../../authorization';
import { ProjectChangeRequestStatus } from './project-change-request-status.enum';
import { ProjectChangeRequestType } from './project-change-request-type.enum';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class UpdateProjectChangeRequest {
  @IdField()
  readonly id: ID;

  @Field(() => [ProjectChangeRequestType], { nullable: true })
  readonly types?: [ProjectChangeRequestType];

  @Field(() => String, { nullable: true })
  readonly summary?: string;

  @Field(() => ProjectChangeRequestStatus, { nullable: true })
  readonly status?: ProjectChangeRequestStatus;

  @Field(() => [Role], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly reviewers?: Role[];
}

@InputType()
export abstract class UpdateProjectChangeRequestInput {
  @Field()
  @Type(() => UpdateProjectChangeRequest)
  @ValidateNested()
  readonly projectChangeRequest: UpdateProjectChangeRequest;
}

@ObjectType()
export abstract class UpdateProjectChangeRequestOutput {
  @Field()
  readonly projectChangeRequest: ProjectChangeRequest;
}
