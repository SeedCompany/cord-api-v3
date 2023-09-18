import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import UploadScalar from 'graphql-upload/GraphQLUpload.mjs';
import type { FileUpload } from 'graphql-upload/Upload.mjs';
import { ID, IdField } from '~/common';
import { MediaUserMetadata } from '../media/media.dto';

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
export abstract class CreateDefinedFileVersionInput {
  @IdField({
    description: 'The ID returned from the `requestFileUpload` mutation',
  })
  readonly uploadId: ID;

  @Field(() => UploadScalar, {
    description: stripIndent`
      A file directly uploaded.
      This is mainly here to allow usage with Apollo Studio/Sandbox.
      For production, prefer the \`url\` from the \`RequestUploadOutput\`.
    `,
    nullable: true,
  })
  readonly file?: Promise<FileUpload>;

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

  @Field({
    description:
      'Extra user media metadata. Note this is only saved if a media mime type is detected',
    nullable: true,
  })
  readonly media?: MediaUserMetadata;
}

@InputType()
export abstract class CreateFileVersionInput extends CreateDefinedFileVersionInput {
  @IdField({
    description:
      'The directory ID if creating a new file or the file ID if creating a new version',
  })
  readonly parentId: ID;
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
