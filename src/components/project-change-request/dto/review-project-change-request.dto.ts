import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, IdField, SecuredProps } from '../../../common';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class ReviewProjectChangeRequest {
  static readonly Props = keysOf<ReviewProjectChangeRequest>();
  static readonly SecuredProps =
    keysOf<SecuredProps<ReviewProjectChangeRequest>>();
  __typename: 'ReviewProjectChangeRequest';

  @IdField({
    description: 'A project change request ID',
  })
  readonly id: ID;

  @Field()
  readonly comment: string;

  @Field()
  readonly approved: boolean;
}

@InputType()
export abstract class ReviewProjectChangeRequestInput {
  @Field()
  @Type(() => ReviewProjectChangeRequest)
  @ValidateNested()
  readonly reviewProjectChangeRequest: ReviewProjectChangeRequest;
}

@ObjectType()
export abstract class ReviewProjectChangeRequestOutput {
  @Field(() => ProjectChangeRequest)
  readonly projectChangeRequest: ProjectChangeRequest;
}
