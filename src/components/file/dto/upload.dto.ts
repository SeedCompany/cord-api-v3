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
    description: stripIndent`
      A temporary url to upload the file to.
      It should be a an HTTP PUT request with the file as the body.
      The Content-Type header should be set to the mime type of the file.
    `,
  })
  readonly url: string;
}

@InputType()
export abstract class CreateDefinedFileVersionInput {
  @IdField({
    description: stripIndent`
      The ID returned from the \`requestFileUpload\` mutation.
      This _can_ be skipped if \`file\` is provided.
    `,
    nullable: true,
  })
  readonly uploadId?: ID;

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
    description: stripIndent`
      The file name. This is generally required.
      It's only optional if \`file\` is provided.
    `,
    nullable: true,
  })
  readonly name?: string;

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
