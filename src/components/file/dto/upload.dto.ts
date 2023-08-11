import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField, IdOf } from '~/common';
import { Directory, FileVersion, IFileNode } from './node';

@ObjectType()
export abstract class RequestUploadOutput {
  @IdField()
  readonly id: IdOf<FileVersion>;

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
  readonly uploadId: IdOf<FileVersion>;

  @IdField({
    description:
      'The directory ID if creating a new file or the file ID if creating a new version',
  })
  readonly parentId: IdOf<IFileNode>;

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
  readonly uploadId: IdOf<FileVersion>;

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
  readonly parentId: IdOf<Directory>;

  @Field({
    description: 'The directory name',
  })
  readonly name: string;
}
