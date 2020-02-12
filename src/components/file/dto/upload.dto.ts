import { Field, ID, InputType, ObjectType } from 'type-graphql';

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
export abstract class CreateFileInput {
  @Field(() => ID, {
    description: 'The ID returned from the CreateUpload mutation',
  })
  readonly uploadId: string;

  @Field(() => ID, {
    description: 'The directory to put this file in',
  })
  readonly parentId: string;

  @Field({
    description: 'The file name',
  })
  readonly name: string;
}

@InputType()
export abstract class UpdateFileInput {
  @Field(() => ID, {
    description: 'The ID returned from the CreateUpload mutation',
  })
  readonly uploadId: string;

  @Field(() => ID, {
    description: 'The file ID to attach this new version to',
  })
  readonly parentId: string;
}
