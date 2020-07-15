import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@ObjectType()
export abstract class RequestUploadOutput {
  @IdField()
  readonly id: string;

  @Field({
    description: 'A pre-signed url to upload the file to',
  })
  readonly url: string;
}

@InputType()
export abstract class CreateFileVersionInput {
  @IdField({
    description: 'The ID returned from the `requestFileUpload` mutation',
  })
  readonly uploadId: string;

  @IdField({
    description:
      'The directory ID if creating a new file or the file ID if creating a new version',
  })
  readonly parentId: string;

  @Field({
    description: 'The file name',
  })
  readonly name: string;
}

@InputType()
export abstract class CreateDefinedFileVersionInput {
  @IdField({
    description: 'The ID returned from the `requestFileUpload` mutation',
  })
  readonly uploadId: string;

  @Field({
    description: 'An optional name. Defaults to file name.',
  })
  readonly name?: string;
}

@InputType()
export abstract class CreateDirectoryInput {
  @IdField({
    description: 'The ID for the parent directory',
  })
  readonly parentId: string;

  @Field({
    description: 'The directory name',
  })
  readonly name: string;
}
