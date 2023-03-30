import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

@ObjectType()
export abstract class RequestUploadOutput {
  @IdField()
  readonly id: ID;

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
  readonly uploadId: ID;

  @IdField({
    description:
      'The directory ID if creating a new file or the file ID if creating a new version',
  })
  readonly parentId: ID;

  @Field({
    description: 'The file name',
  })
  readonly name: string;

  @Field({
    description:
      'Override the mime type of the file. Default pulls mime type defined on uploaded file',
    nullable: true,
  })
  readonly mimeType?: string;
}

@InputType()
export abstract class CreateDefinedFileVersionInput {
  @IdField({
    description: 'The ID returned from the `requestFileUpload` mutation',
  })
  readonly uploadId: ID;

  @Field({
    description: 'The file name',
  })
  readonly name: string;

  @Field({
    description:
      'Override the mime type of the file version. Default pulls mime type defined on uploaded file',
    nullable: true,
  })
  readonly mimeType?: string;
}

@InputType()
export abstract class CreateDirectoryInput {
  @IdField({
    description: 'The ID for the parent directory',
  })
  readonly parentId: ID;

  @Field({
    description: 'The directory name',
  })
  readonly name: string;
}
