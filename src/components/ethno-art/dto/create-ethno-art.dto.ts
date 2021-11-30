import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture';
import { EthnoArt } from './ethno-art.dto';

@InputType()
export abstract class CreateEthnoArt {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] = [];
}

@InputType()
export abstract class CreateEthnoArtInput {
  @Field()
  @Type(() => CreateEthnoArt)
  @ValidateNested()
  readonly ethnoArt: CreateEthnoArt;
}

@ObjectType()
export abstract class CreateEthnoArtOutput {
  @Field()
  readonly ethnoArt: EthnoArt;
}
