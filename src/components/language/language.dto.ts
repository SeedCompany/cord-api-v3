import { Field, InputType, ObjectType } from 'type-graphql';
import { Language } from './language';

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
  @Field({ nullable: true }) // nullable in case of error
  language: CreateLanguageOutput;
  constructor() {
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
// List all languages (query)

@InputType()
export class ListLanguagesInput {
  @Field(type => String, { nullable: true, defaultValue: '' })
  filter: string;
  @Field(type => Number, { nullable: true, defaultValue: 0 })
  page: number;
  @Field(type => Number, { nullable: true, defaultValue: 25 })
  count: number;
  @Field(type => String, { nullable: true, defaultValue: 'DESC' })
  order: string;
  @Field(type => String, { nullable: true, defaultValue: 'name' })
  sort: string;
}

@InputType()
export class ListLanguagesInputDto {
  @Field()
  query: ListLanguagesInput;
}

@ObjectType()
export class ListLanguagesOutput {
  @Field(type => Language, { nullable: true })
  language: Language;
}

@ObjectType()
export class ListLanguagesOutputDto {
  @Field(type => [Language], { nullable: true }) // nullable in case of error
  languages: Language[];
  constructor() {
    this.languages = [];
  }
}
