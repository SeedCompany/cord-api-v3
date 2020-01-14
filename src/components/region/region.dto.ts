import { ObjectType, Field, InputType } from 'type-graphql';

// CREATE
@InputType()
export class CreateRegionInput {
  @Field(type => String)
  name: string;
}

@InputType()
export class CreateRegionInputDto {
  @Field()
  region: CreateRegionInput;
}

@ObjectType()
export class CreateRegionOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class CreateRegionOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  region: CreateRegionOutput;

  constructor() {
    this.region = new CreateRegionOutput();
  }
}

// READ

@InputType()
export class ReadRegionInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadRegionInputDto {
  @Field()
  region: ReadRegionInput;
}

@ObjectType()
export class ReadRegionOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class ReadRegionOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  region: ReadRegionOutput;

  constructor() {
    this.region = new ReadRegionOutput();
  }
}

// UPDATE

@InputType()
export class UpdateRegionInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@InputType()
export class UpdateRegionInputDto {
  @Field()
  region: UpdateRegionInput;
}

@ObjectType()
export class UpdateRegionOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class UpdateRegionOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  region: UpdateRegionOutput;

  constructor() {
    this.region = new UpdateRegionOutput();
  }
}

// DELETE

@InputType()
export class DeleteRegionInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteRegionInputDto {
  @Field()
  region: DeleteRegionInput;
}

@ObjectType()
export class DeleteRegionOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteRegionOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  region: DeleteRegionOutput;

  constructor() {
    this.region = new DeleteRegionOutput();
  }
}
