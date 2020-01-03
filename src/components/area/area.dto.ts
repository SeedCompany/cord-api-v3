import { ObjectType, Field, InputType } from 'type-graphql';

// CREATE
@InputType()
export class CreateAreaInput {
  @Field(type => String)
  name: string;
}

@InputType()
export class CreateAreaInputDto {
  @Field()
  area: CreateAreaInput;
}

@ObjectType()
export class CreateAreaOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class CreateAreaOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  area: CreateAreaOutput;

  constructor() {
    this.area = new CreateAreaOutput();
  }
}

// READ

@InputType()
export class ReadAreaInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadAreaInputDto {
  @Field()
  area: ReadAreaInput;
}

@ObjectType()
export class ReadAreaOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class ReadAreaOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  area: ReadAreaOutput;

  constructor() {
    this.area = new ReadAreaOutput();
  }
}

// UPDATE

@InputType()
export class UpdateAreaInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@InputType()
export class UpdateAreaInputDto {
  @Field()
  area: UpdateAreaInput;
}

@ObjectType()
export class UpdateAreaOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class UpdateAreaOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  area: UpdateAreaOutput;

  constructor() {
    this.area = new UpdateAreaOutput();
  }
}

// DELETE

@InputType()
export class DeleteAreaInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteAreaInputDto {
  @Field()
  area: DeleteAreaInput;
}

@ObjectType()
export class DeleteAreaOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteAreaOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  area: DeleteAreaOutput;

  constructor() {
    this.area = new DeleteAreaOutput();
  }
}
