import { Field, ID, InputType, ObjectType } from 'type-graphql';

// CREATE

@InputType()
export class CreateLanguageInput {
  @Field(type => String)
  name: string;
}

@InputType()
export class CreateLanguageInputDto {
  @Field()
  language: CreateLanguageInput;
}

@ObjectType()
export class CreateLanguageOutput {
    @Field(type => String)
    id: string;
    @Field(type => String)
    name: string;
}

@ObjectType()
export class CreateLanguageOutputDto {
  @Field({nullable: true}) // nullable in case of error
  language: CreateLanguageOutput;
  constructor(){
      this.language = new CreateLanguageOutput();
  }
}

// READ

@InputType()
export class ReadLanguageInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadLanguageInputDto {
  @Field()
  language: ReadLanguageInput;
}

@ObjectType()
export class ReadLanguageOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class ReadLanguageOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  language: ReadLanguageOutput;
  constructor() {
    this.language = new ReadLanguageOutput();
  }
}

// UPDATE

@InputType()
export class UpdateLanguageInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@InputType()
export class UpdateLanguageInputDto {
  @Field()
  language: UpdateLanguageInput;
}

@ObjectType()
export class UpdateLanguageOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class UpdateLanguageOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  language: UpdateLanguageOutput;
  constructor() {
    this.language = new UpdateLanguageOutput();
  }
}

// DELETE

@InputType()
export class DeleteLanguageInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteLanguageInputDto {
  @Field()
  language: DeleteLanguageInput;
}

@ObjectType()
export class DeleteLanguageOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteLanguageOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  language: DeleteLanguageOutput;
  constructor() {
    this.language = new DeleteLanguageOutput();
  }
}
