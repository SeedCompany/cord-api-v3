import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../../common';
import { Property } from './property.dto';

@InputType()
export class CreateProperty {
  @IdField({
    description: 'A project ID',
  })
  readonly projectId: string;

  @Field()
  readonly value: string;
}

@InputType()
export abstract class CreatePropertyInput {
  @Field()
  @Type(() => CreateProperty)
  @ValidateNested()
  readonly property: CreateProperty;
}

@ObjectType()
export abstract class CreatePropertyOutput {
  @Field()
  readonly property: Property;
}
