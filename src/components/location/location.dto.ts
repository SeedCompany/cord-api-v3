import { ObjectType, Field, InputType } from 'type-graphql';

// CREATE
@InputType()
export class CreateLocationInput {
  @Field(type => String)
  name: string;
}

@InputType()
export class CreateLocationInputDto {
  @Field()
  location: CreateLocationInput;
}

@ObjectType()
export class CreateLocationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class CreateLocationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  location: CreateLocationOutput;

  constructor() {
    this.location = new CreateLocationOutput();
  }
}

// READ

@InputType()
export class ReadLocationInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadLocationInputDto {
  @Field()
  location: ReadLocationInput;
}

@ObjectType()
export class ReadLocationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class ReadLocationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  location: ReadLocationOutput;

  constructor() {
    this.location = new ReadLocationOutput();
  }
}

// UPDATE

@InputType()
export class UpdateLocationInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@InputType()
export class UpdateLocationInputDto {
  @Field()
  location: UpdateLocationInput;
}

@ObjectType()
export class UpdateLocationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class UpdateLocationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  location: UpdateLocationOutput;

  constructor() {
    this.location = new UpdateLocationOutput();
  }
}

// DELETE

@InputType()
export class DeleteLocationInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteLocationInputDto {
  @Field()
  location: DeleteLocationInput;
}

@ObjectType()
export class DeleteLocationOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteLocationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  location: DeleteLocationOutput;

  constructor() {
    this.location = new DeleteLocationOutput();
  }
}
