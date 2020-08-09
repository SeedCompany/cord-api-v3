import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { RegistryOfGeography } from './registry-of-geography.dto';

@InputType()
export abstract class UpdateRegistryOfGeography {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @IdField({
    description: 'A registry ID',
    nullable: true,
  })
  readonly registryId?: string;
}

@InputType()
export abstract class UpdateRegistryOfGeographyInput {
  @Field()
  @Type(() => UpdateRegistryOfGeography)
  @ValidateNested()
  readonly registryOfGeography: UpdateRegistryOfGeography;
}

@ObjectType()
export abstract class UpdateRegistryOfGeographyOutput {
  @Field()
  readonly registryOfGeography: RegistryOfGeography;
}
