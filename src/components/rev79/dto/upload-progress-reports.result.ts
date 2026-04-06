import { Field, ObjectType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';
import { type ProgressReport } from '../../progress-report/dto';

@ObjectType()
export class Rev79ReportUploadResult {
  @Field({
    description: 'The Rev79 community ID from the input item.',
  })
  readonly rev79CommunityId: string;

  @IdField({
    description: 'The Cord progress report ID that was updated.',
  })
  readonly progressReport: ID<ProgressReport>;
}

@ObjectType()
export class Rev79BulkUploadResult {
  @Field(() => [Rev79ReportUploadResult])
  readonly results: readonly Rev79ReportUploadResult[];
}
