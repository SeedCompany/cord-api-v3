import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { ScriptureRangeInput } from '../../scripture';
import { EthnoArt } from './ethno-art.dto';

@InputType()
export abstract class CreateEthnoArt {
  @NameField()
  readonly name: string;

  @Field(() => [ScriptureRangeInput], { nullable: true })
  @ValidateNested()
  @Type(() => ScriptureRangeInput)
  readonly scriptureReferences?: ScriptureRangeInput[] = [];
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
