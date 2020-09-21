import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { RegistryOfGeography } from './registry-of-geography.dto';

@InputType()
export abstract class CreateRegistryOfGeography {
  @NameField()
  readonly name: string;

  @IdField({
    description: 'A registry ID',
    nullable: true,
  })
  readonly registryId: string;
}

@InputType()
export abstract class CreateRegistryOfGeographyInput {
  @Field()
  @Type(() => CreateRegistryOfGeography)
  @ValidateNested()
  readonly registryOfGeography: CreateRegistryOfGeography;
}

@ObjectType()
export abstract class CreateRegistryOfGeographyOutput {
  @Field()
  readonly registryOfGeography: RegistryOfGeography;
}
