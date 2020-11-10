import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';

@InputType()
export class DeleteProjectEngagement {
  @IdField()
  readonly engagementId: string;
  @IdField()
  readonly projectId: string;
}

@InputType()
export class DeleteProjectEngagementInput {
  @Field()
  @Type(() => DeleteProjectEngagement)
  @ValidateNested()
  readonly projectEngagement: DeleteProjectEngagement;
}
