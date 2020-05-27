import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export abstract class RequestUploadOutput {
  @Field(() => ID)
  readonly id: string;

  @Field({
    description: 'A pre-signed url to upload the file to',
  })
  readonly url: string;
}

@InputType()
export abstract class CreateFileVersionInput {
  @Field(() => ID, {
    description: 'The ID returned from the `requestFileUpload` mutation',
  })
  readonly uploadId: string;

  @Field(() => ID, {
    description:
      'The directory ID if creating a new file or the file ID if creating a new version',
  })
  readonly parentId: string;

  @Field({
    description: 'The file name',
  })
  readonly name: string;
}
