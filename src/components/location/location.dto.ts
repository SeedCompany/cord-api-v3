import { ObjectType, Field, InputType } from 'type-graphql';
import { Location } from './location';

// CREATE
@InputType()
export class CreateLocationInput {
  @Field(type => String)
  country: string;
  @Field(type => String)
  area: string;
  @Field(type => Boolean)
  editable: boolean;
}

@InputType()
export class CreateLocationInputDto {
  @Field(type => CreateLocationInput)
  location: CreateLocationInput;
}

@ObjectType()
export class CreateLocationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  country: string;
  @Field(type => String)
  area: string;
  @Field(type => Boolean)
  editable: boolean;
}

@ObjectType()
export class CreateLocationOutputDto {
  @Field(type => CreateLocationOutput, { nullable: true }) // nullable in case of error
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
  @Field(type => ReadLocationInput)
  location: ReadLocationInput;
}

@ObjectType()
export class ReadLocationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  country: string;
  @Field(type => String)
  area: string;
  @Field(type => Boolean)
  editable: boolean;
}

@ObjectType()
export class ReadLocationOutputDto {
  @Field(type => ReadLocationOutput, { nullable: true }) // nullable in case of error
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
  country: string;
  @Field(type => String)
  area: string;
  @Field(type => Boolean)
  editable: boolean;
}

@InputType()
export class UpdateLocationInputDto {
  @Field(type => UpdateLocationInput)
  location: UpdateLocationInput;
}

@ObjectType()
export class UpdateLocationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  country: string;
  @Field(type => String)
  area: string;
  @Field(type => Boolean)
  editable: boolean;
}

@ObjectType()
export class UpdateLocationOutputDto {
  @Field(type => UpdateLocationOutput, { nullable: true }) // nullable in case of error
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
  @Field(type => DeleteLocationInput)
  location: DeleteLocationInput;
}

@ObjectType()
export class DeleteLocationOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteLocationOutputDto {
  @Field(type => DeleteLocationOutput, { nullable: true }) // nullable in case of error
  location: DeleteLocationOutput;

  constructor() {
    this.location = new DeleteLocationOutput();
  }
}

// LIST

@InputType()
export class ListLocationsInput {
  @Field(type => String, { nullable: true, defaultValue: '' })
  filter: string;
  @Field(type => Number, { nullable: true, defaultValue: 0 })
  page: number;
  @Field(type => Number, { nullable: true, defaultValue: 25 })
  count: number;
  @Field(type => String, { nullable: true, defaultValue: 'DESC' })
  order: string;
  @Field(type => String, { nullable: true, defaultValue: 'country' })
  sort: string;
}

@InputType()
export class ListLocationsInputDto {
  @Field()
  query: ListLocationsInput;
}

@ObjectType()
export class ListLocationsOutput {
  @Field(type => Location, { nullable: true })
  location: Location;
}

@ObjectType()
export class ListLocationsOutputDto {
  @Field(type => [Location], { nullable: true }) // nullable in case of error
  countries: Location[];
  constructor() {
    this.countries = [];
  }
}
