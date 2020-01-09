import { Field, InputType, ObjectType } from 'type-graphql';

// CREATE

@InputType()
export class CreateUserInput {
  @Field(type => String)
  email: string;
}

@InputType()
export class CreateUserInputDto {
  @Field()
  user: CreateUserInput;
}

@ObjectType()
export class CreateUserOutput {
    @Field(type => String)
    id: string;
    @Field(type => String)
    email: string;
}

@ObjectType()
export class CreateUserOutputDto {
  @Field({nullable: true}) // nullable in case of error
  user: CreateUserOutput;
  constructor(){
      this.user = new CreateUserOutput();
  }
}

// READ

@InputType()
export class ReadUserInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadUserInputDto {
  @Field()
  user: ReadUserInput;
}

@ObjectType()
export class ReadUserOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  email: string;
}

@ObjectType()
export class ReadUserOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  user: ReadUserOutput;
  constructor() {
    this.user = new ReadUserOutput();
  }
}

// UPDATE

@InputType()
export class UpdateUserInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  email: string;
}

@InputType()
export class UpdateUserInputDto {
  @Field()
  user: UpdateUserInput;
}

@ObjectType()
export class UpdateUserOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  email: string;
}

@ObjectType()
export class UpdateUserOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  user: UpdateUserOutput;
  constructor() {
    this.user = new UpdateUserOutput();
  }
}

// DELETE

@InputType()
export class DeleteUserInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteUserInputDto {
  @Field()
  user: DeleteUserInput;
}

@ObjectType()
export class DeleteUserOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteUserOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  user: DeleteUserOutput;
  constructor() {
    this.user = new DeleteUserOutput();
  }
}
